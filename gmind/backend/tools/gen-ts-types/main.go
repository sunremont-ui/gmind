package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type Field struct {
	Name string
	Type string
	Opt  bool
}

type StructDef struct {
	Name   string
	Fields []Field
}

var goToTS = map[string]string{
	"string":        "string",
	"int":           "number",
	"int64":         "number",
	"float32":       "number",
	"float64":       "number",
	"bool":          "boolean",
	"interface{}":   "unknown",
	"[]string":      "string[]",
	"[]*string":     "string[]",
	"[]int":         "number[]",
	"[]float64":     "number[]",
	"[]interface{}": "unknown[]",
	"time.Time":     "string",
	"*bool":         "boolean",
}

func main() {
	modelDir := filepath.Join("internal", "model")
	fset := token.NewFileSet()
	pkgs, err := parser.ParseDir(fset, modelDir, nil, parser.ParseComments)
	if err != nil {
		panic(err)
	}

	pkg := pkgs["model"]
	if pkg == nil {
		panic("model package not found")
	}

	structs, typeAliases := parseAllTypes(pkg)

	// Sort by name
	sort.Slice(structs, func(i, j int) bool { return structs[i].Name < structs[j].Name })
	sort.Slice(typeAliases, func(i, j int) bool { return typeAliases[i].Name < typeAliases[j].Name })

	var sb strings.Builder
	sb.WriteString("// Auto-generated from Go model types. DO NOT EDIT.\n")
	sb.WriteString("// Run: cd backend && go run tools/gen-ts-types/main.go\n\n")

	// Generate type aliases first (e.g., ErrorCode = string)
	for _, ta := range typeAliases {
		sb.WriteString(fmt.Sprintf("export type %s = %s\n\n", ta.Name, ta.Target))
	}

	for _, s := range structs {
		sb.WriteString(fmt.Sprintf("export interface %s {\n", s.Name))
		for _, f := range s.Fields {
			opt := ""
			if f.Opt {
				opt = "?"
			}
			sb.WriteString(fmt.Sprintf("  %s%s: %s\n", f.Name, opt, f.Type))
		}
		sb.WriteString("}\n\n")
	}

	outPath := filepath.Join("..", "frontend", "src", "types", "api.ts")
	abs, err := filepath.Abs(outPath)
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(abs, []byte(sb.String()), 0644); err != nil {
		panic(err)
	}
	fmt.Println("Generated:", abs)
}

type TypeAlias struct {
	Name   string
	Target string
}

func parseAllTypes(pkg *ast.Package) (structs []StructDef, aliases []TypeAlias) {
	skip := map[string]bool{
		"WSMessage":  true,
		"LayoutNode": true,
	}

	for _, file := range pkg.Files {
		for _, decl := range file.Decls {
			genDecl, ok := decl.(*ast.GenDecl)
			if !ok || genDecl.Tok != token.TYPE {
				continue
			}
			for _, spec := range genDecl.Specs {
				typeSpec, ok := spec.(*ast.TypeSpec)
				if !ok {
					continue
				}
				name := typeSpec.Name.Name
				if !ast.IsExported(name) || skip[name] {
					continue
				}

				// Handle type aliases (type Foo = Bar / type Foo string)
				if ident, ok := typeSpec.Type.(*ast.Ident); ok {
					if ts, ok := goToTS[ident.Name]; ok {
						aliases = append(aliases, TypeAlias{Name: name, Target: ts})
					} else {
						aliases = append(aliases, TypeAlias{Name: name, Target: ident.Name})
					}
					continue
				}

				// Handle structs
				structType, ok := typeSpec.Type.(*ast.StructType)
				if !ok {
					continue
				}

				var fields []Field
				for _, f := range structType.Fields.List {
					if len(f.Names) == 0 {
						continue
					}
					fieldName := f.Names[0].Name
					if !ast.IsExported(fieldName) {
						continue
					}
					jsonName, opt := jsonTag(f)
					if jsonName == "-" || jsonName == "" {
						continue
					}
					tsType := goExprToTS(f.Type)
					fields = append(fields, Field{Name: jsonName, Type: tsType, Opt: opt})
				}
				if len(fields) > 0 {
					structs = append(structs, StructDef{Name: name, Fields: fields})
				}
			}
		}
	}
	return
}

func jsonTag(f *ast.Field) (name string, omitempty bool) {
	if f.Tag == nil {
		return "", false
	}
	tag := f.Tag.Value
	tag = strings.Trim(tag, "`")
	r := regexp.MustCompile(`json:"([^"]*)"`)
	m := r.FindStringSubmatch(tag)
	if len(m) < 2 {
		return "", false
	}
	parts := strings.Split(m[1], ",")
	if len(parts) == 0 || parts[0] == "" {
		return "", false
	}
	name = parts[0]
	for _, p := range parts[1:] {
		if p == "omitempty" {
			omitempty = true
		}
	}
	return name, omitempty
}

func goExprToTS(expr ast.Expr) string {
	switch t := expr.(type) {
	case *ast.Ident:
		name := t.Name
		if ts, ok := goToTS[name]; ok {
			return ts
		}
		if ast.IsExported(name) {
			return name
		}
		return name

	case *ast.StarExpr:
		inner := goExprToTS(t.X)
		// If inner is a built-in, handle pointer
		if ts, ok := goToTS["*"+inner]; ok {
			return ts
		}
		return inner

	case *ast.ArrayType:
		if el, ok := t.Elt.(*ast.StarExpr); ok {
			if ident, ok := el.X.(*ast.Ident); ok {
				if ast.IsExported(ident.Name) {
					return ident.Name + "[]"
				}
			}
			return goExprToTS(el.X) + "[]"
		}
		if ident, ok := t.Elt.(*ast.Ident); ok {
			full := "[]" + ident.Name
			if ts, ok := goToTS[full]; ok {
				return ts
			}
			if ast.IsExported(ident.Name) {
				return ident.Name + "[]"
			}
			return ident.Name + "[]"
		}
		if _, ok := t.Elt.(*ast.InterfaceType); ok {
			return "unknown[]"
		}
		return goExprToTS(t.Elt) + "[]"

	case *ast.SelectorExpr:
		if pkg, ok := t.X.(*ast.Ident); ok {
			full := pkg.Name + "." + t.Sel.Name
			if ts, ok := goToTS[full]; ok {
				return ts
			}
		}
		return goExprToTS(t.Sel)

	case *ast.MapType:
		key := goExprToTS(t.Key)
		val := goExprToTS(t.Value)
		return fmt.Sprintf("Record<%s, %s>", key, val)

	case *ast.InterfaceType:
		return "unknown"

	default:
		return "unknown"
	}
}
