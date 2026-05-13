// Package migrations embeds SQL migration files for runtime use.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
