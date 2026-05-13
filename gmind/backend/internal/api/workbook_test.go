package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gmind/backend/internal/config"
	"github.com/gmind/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

func newTestHandler(t *testing.T) (*Handler, *store.Store) {
	t.Helper()
	s, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })

	h := New(s, nil, "", nil)
	return h, s
}

func newTestRouter(t *testing.T) (http.Handler, *store.Store) {
	t.Helper()
	h, s := newTestHandler(t)
	cfg := &config.Config{
		AllowedOrigins: []string{"*"},
		AIEndpoint:     "https://api.openai.com/v1",
		AIModel:        "gpt-4o",
		AIAPIKey:       "",
	}
	return h.Router(cfg), s
}

func requestJSON(t *testing.T, method, path string, body interface{}) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	r := httptest.NewRequest(method, path, &buf)
	r.Header.Set("Content-Type", "application/json")
	return r
}

func TestListWorkbooks(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/workbooks", nil))

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var list []interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
}

func TestCreateWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "New Workbook"}))

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Errorf("status = %d, want 200 or 201, body=%s", w.Code, w.Body.String())
	}

	var res map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if res["title"] != "New Workbook" {
		t.Errorf("title = %v, want %q", res["title"], "New Workbook")
	}
}

func TestCreateWorkbookInvalidBody(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/api/v1/workbooks", bytes.NewReader([]byte(`{bad json}`))))

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetWorkbook(t *testing.T) {
	router, s := newTestRouter(t)

	// Create a workbook first
	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Get Test"}))
	var created map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &created)
	id := created["id"].(string)

	// Get it
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, requestJSON(t, "GET", "/api/v1/workbooks/"+id, nil))

	if getW.Code != http.StatusOK {
		t.Errorf("status = %d, want %d, body=%s", getW.Code, http.StatusOK, getW.Body.String())
	}

	// Get nonexistent
	notFoundW := httptest.NewRecorder()
	router.ServeHTTP(notFoundW, requestJSON(t, "GET", "/api/v1/workbooks/nonexistent", nil))
	if notFoundW.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", notFoundW.Code, http.StatusNotFound)
	}

	_ = s // keep reference to avoid unused
}

func TestUpdateWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)

	// Create
	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Before"}))
	var created map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &created)
	id := created["id"].(string)

	// Update
	updateW := httptest.NewRecorder()
	router.ServeHTTP(updateW, requestJSON(t, "PUT", "/api/v1/workbooks/"+id, map[string]interface{}{
		"id":     id,
		"title":  "After",
		"sheets": []interface{}{},
	}))

	if updateW.Code != http.StatusOK {
		t.Errorf("status = %d, want %d, body=%s", updateW.Code, http.StatusOK, updateW.Body.String())
	}
}

func TestDeleteWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)

	// Create
	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Delete Me"}))
	var created map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &created)
	id := created["id"].(string)

	// Delete
	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, requestJSON(t, "DELETE", "/api/v1/workbooks/"+id, nil))
	if delW.Code != http.StatusOK && delW.Code != http.StatusNoContent {
		t.Errorf("status = %d, want 200 or 204", delW.Code)
	}

	// Verify gone
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, requestJSON(t, "GET", "/api/v1/workbooks/"+id, nil))
	if getW.Code != http.StatusNotFound {
		t.Errorf("after delete: status = %d, want %d", getW.Code, http.StatusNotFound)
	}
}

func TestTopicCRUD(t *testing.T) {
	router, _ := newTestRouter(t)

	// Create workbook
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Topic Test"}))
	var wb map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &wb)
	wbID := wb["id"].(string)
	sheets := wb["sheets"].([]interface{})
	sheet := sheets[0].(map[string]interface{})
	rootTopic := sheet["root_topic"].(map[string]interface{})
	rootID := rootTopic["id"].(string)

	// Create child topic
	childW := httptest.NewRecorder()
	router.ServeHTTP(childW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     "Child",
		"parent_id": rootID,
	}))
	if childW.Code != http.StatusOK && childW.Code != http.StatusCreated {
		t.Fatalf("create topic: status=%d, body=%s", childW.Code, childW.Body.String())
	}

	var child map[string]interface{}
	json.Unmarshal(childW.Body.Bytes(), &child)
	childID := child["id"].(string)

	// Update topic
	updW := httptest.NewRecorder()
	router.ServeHTTP(updW, requestJSON(t, "PUT", "/api/v1/workbooks/"+wbID+"/topics/"+childID, map[string]string{
		"title": "Updated Child",
	}))
	if updW.Code != http.StatusOK {
		t.Errorf("update topic: status=%d", updW.Code)
	}

	// Delete topic
	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, requestJSON(t, "DELETE", "/api/v1/workbooks/"+wbID+"/topics/"+childID, nil))
	if delW.Code != http.StatusOK && delW.Code != http.StatusNoContent {
		t.Errorf("delete topic: status=%d", delW.Code)
	}
}

func TestHealthEndpoint(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var res map[string]string
	json.Unmarshal(w.Body.Bytes(), &res)
	if res["status"] != "ok" {
		t.Errorf("status = %q, want %q", res["status"], "ok")
	}
}

// Test that chi URL params work correctly
func TestChiRouting(t *testing.T) {
	r := chi.NewRouter()
	r.Get("/api/v1/workbooks/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := chi.URLParam(r, "id")
		w.Write([]byte(id))
	})
}

func TestEmptyList(t *testing.T) {
	s, err := store.New(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	list, err := s.ListWorkbooks()
	if err != nil {
		t.Fatalf("ListWorkbooks: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("len = %d, want 0", len(list))
	}
}

func TestRouterWithNilDeps(t *testing.T) {
	h := New(nil, nil, "", nil)
	cfg := &config.Config{AllowedOrigins: []string{"*"}}
	router := h.Router(cfg)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/health", nil))
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

// --- Sheet CRUD tests ---

func TestCreateSheet(t *testing.T) {
	router, _ := newTestRouter(t)

	// Create workbook
	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	// Create sheet
	sheetW := httptest.NewRecorder()
	router.ServeHTTP(sheetW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/sheets", map[string]string{"title": "Sheet 2"}))
	if sheetW.Code != http.StatusCreated {
		t.Fatalf("create sheet: status=%d, body=%s", sheetW.Code, sheetW.Body.String())
	}

	var sheet map[string]interface{}
	json.Unmarshal(sheetW.Body.Bytes(), &sheet)
	if sheet["title"] != "Sheet 2" {
		t.Errorf("title = %v, want 'Sheet 2'", sheet["title"])
	}
}

func TestCreateSheetNonexistentWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/nonexistent/sheets", map[string]string{"title": "Sheet"}))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestUpdateSheet(t *testing.T) {
	router, _ := newTestRouter(t)

	// Create workbook
	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	// Get first sheet
	sheets := wb["sheets"].([]interface{})
	sheet := sheets[0].(map[string]interface{})
	sheetID := sheet["id"].(string)

	// Update
	updateW := httptest.NewRecorder()
	router.ServeHTTP(updateW, requestJSON(t, "PUT", "/api/v1/workbooks/"+wbID+"/sheets/"+sheetID, map[string]string{
		"title": "Renamed Sheet",
	}))
	if updateW.Code != http.StatusOK {
		t.Fatalf("update sheet: status=%d, body=%s", updateW.Code, updateW.Body.String())
	}

	var updated map[string]interface{}
	json.Unmarshal(updateW.Body.Bytes(), &updated)
	if updated["title"] != "Renamed Sheet" {
		t.Errorf("title = %v, want 'Renamed Sheet'", updated["title"])
	}
}

func TestDeleteSheet(t *testing.T) {
	router, _ := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	// Get first sheet
	sheets := wb["sheets"].([]interface{})
	sheet := sheets[0].(map[string]interface{})
	sheetID := sheet["id"].(string)

	// Delete
	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, requestJSON(t, "DELETE", "/api/v1/workbooks/"+wbID+"/sheets/"+sheetID, nil))
	if delW.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", delW.Code, http.StatusNoContent)
	}
}

// --- Floating Topics tests ---

func TestCreateFloatingTopic(t *testing.T) {
	router, _ := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	ftW := httptest.NewRecorder()
	router.ServeHTTP(ftW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/floating-topics", map[string]interface{}{
		"title":    "Floating",
		"position": map[string]float64{"x": 100, "y": 200},
	}))
	if ftW.Code != http.StatusCreated {
		t.Fatalf("create floating topic: status=%d, body=%s", ftW.Code, ftW.Body.String())
	}

	var ft map[string]interface{}
	json.Unmarshal(ftW.Body.Bytes(), &ft)
	if ft["title"] != "Floating" {
		t.Errorf("title = %v, want 'Floating'", ft["title"])
	}
}

func TestUpdateFloatingTopic(t *testing.T) {
	router, _ := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	// Create floating
	ftW := httptest.NewRecorder()
	router.ServeHTTP(ftW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/floating-topics", map[string]interface{}{
		"title":    "Original",
		"position": map[string]float64{"x": 100, "y": 100},
	}))
	var ft map[string]interface{}
	json.Unmarshal(ftW.Body.Bytes(), &ft)
	ftID := ft["id"].(string)

	// Update
	updW := httptest.NewRecorder()
	router.ServeHTTP(updW, requestJSON(t, "PUT", "/api/v1/workbooks/"+wbID+"/floating-topics/"+ftID, map[string]interface{}{
		"title":    "Updated",
		"position": map[string]float64{"x": 300, "y": 400},
	}))
	if updW.Code != http.StatusOK {
		t.Fatalf("update floating: status=%d, body=%s", updW.Code, updW.Body.String())
	}
}

func TestDeleteFloatingTopic(t *testing.T) {
	router, _ := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	// Create floating
	ftW := httptest.NewRecorder()
	router.ServeHTTP(ftW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/floating-topics", map[string]interface{}{
		"title": "Delete Me",
	}))
	var ft map[string]interface{}
	json.Unmarshal(ftW.Body.Bytes(), &ft)
	ftID := ft["id"].(string)

	// Delete
	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, requestJSON(t, "DELETE", "/api/v1/workbooks/"+wbID+"/floating-topics/"+ftID, nil))
	if delW.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", delW.Code, http.StatusNoContent)
	}
}

// --- Relationships tests ---

func TestCreateRelationship(t *testing.T) {
	router, _ := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)
	sheets := wb["sheets"].([]interface{})
	sheet := sheets[0].(map[string]interface{})
	rootTopic := sheet["root_topic"].(map[string]interface{})
	rootID := rootTopic["id"].(string)

	childW1 := httptest.NewRecorder()
	router.ServeHTTP(childW1, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     "A",
		"parent_id": rootID,
	}))
	var child1 map[string]interface{}
	json.Unmarshal(childW1.Body.Bytes(), &child1)
	child1ID := child1["id"].(string)

	childW2 := httptest.NewRecorder()
	router.ServeHTTP(childW2, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     "B",
		"parent_id": rootID,
	}))
	var child2 map[string]interface{}
	json.Unmarshal(childW2.Body.Bytes(), &child2)
	child2ID := child2["id"].(string)

	relW := httptest.NewRecorder()
	router.ServeHTTP(relW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/relationships", map[string]string{
		"title":   "relates to",
		"end1_id": child1ID,
		"end2_id": child2ID,
	}))
	if relW.Code != http.StatusCreated {
		t.Fatalf("create relationship: status=%d, body=%s", relW.Code, relW.Body.String())
	}
}

func TestDeleteRelationship(t *testing.T) {
	router, _ := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)
	sheets := wb["sheets"].([]interface{})
	sheet := sheets[0].(map[string]interface{})
	rootTopic := sheet["root_topic"].(map[string]interface{})
	rootID := rootTopic["id"].(string)

	// Create child -> create relationship
	childW := httptest.NewRecorder()
	router.ServeHTTP(childW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     "A",
		"parent_id": rootID,
	}))
	var child map[string]interface{}
	json.Unmarshal(childW.Body.Bytes(), &child)
	childID := child["id"].(string)

	childW2 := httptest.NewRecorder()
	router.ServeHTTP(childW2, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     "B",
		"parent_id": rootID,
	}))
	var child2 map[string]interface{}
	json.Unmarshal(childW2.Body.Bytes(), &child2)
	child2ID := child2["id"].(string)

	relW := httptest.NewRecorder()
	router.ServeHTTP(relW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/relationships", map[string]string{
		"title":   "link",
		"end1_id": childID,
		"end2_id": child2ID,
	}))
	var rel map[string]interface{}
	json.Unmarshal(relW.Body.Bytes(), &rel)
	relID := rel["id"].(string)

	// Delete relationship
	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, requestJSON(t, "DELETE", "/api/v1/workbooks/"+wbID+"/relationships/"+relID, nil))
	if delW.Code != http.StatusNoContent {
		t.Errorf("delete relationship: status=%d", delW.Code)
	}
}

// --- Move topic test ---

func TestMoveTopic(t *testing.T) {
	router, _ := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)
	sheets := wb["sheets"].([]interface{})
	sheet := sheets[0].(map[string]interface{})
	rootTopic := sheet["root_topic"].(map[string]interface{})
	rootID := rootTopic["id"].(string)
	child1W := httptest.NewRecorder()
	router.ServeHTTP(child1W, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     "Child 1",
		"parent_id": rootID,
	}))
	var child1 map[string]interface{}
	json.Unmarshal(child1W.Body.Bytes(), &child1)
	child1ID := child1["id"].(string)

	child2W := httptest.NewRecorder()
	router.ServeHTTP(child2W, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     "Child 2",
		"parent_id": rootID,
	}))
	var child2 map[string]interface{}
	json.Unmarshal(child2W.Body.Bytes(), &child2)
	child2ID := child2["id"].(string)

	// Move child2 under child1
	moveW := httptest.NewRecorder()
	router.ServeHTTP(moveW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics/"+child2ID+"/move", map[string]interface{}{
		"new_parent_id": child1ID,
		"index":         0,
	}))
	if moveW.Code != http.StatusOK {
		t.Fatalf("move topic: status=%d, body=%s", moveW.Code, moveW.Body.String())
	}

	// Verify by getting workbook
	getW := httptest.NewRecorder()
	router.ServeHTTP(getW, requestJSON(t, "GET", "/api/v1/workbooks/"+wbID, nil))
	var updatedWb map[string]interface{}
	json.Unmarshal(getW.Body.Bytes(), &updatedWb)
	updatedSheets := updatedWb["sheets"].([]interface{})
	updatedSheet := updatedSheets[0].(map[string]interface{})
	updatedRoot := updatedSheet["root_topic"].(map[string]interface{})
	updatedChildren := updatedRoot["children"].([]interface{})

	// Root has Child 1 + Child 2 = 2
	// After moving Child 2 under Child 1: root has 1 (Child 1), Child 1 has 1 child (Child 2)
	if len(updatedChildren) != 1 {
		t.Errorf("root children count = %d, want 1", len(updatedChildren))
	}
	// Find Child 1 among root's children
	var child1Node map[string]interface{}
	for _, c := range updatedChildren {
		node := c.(map[string]interface{})
		if node["title"] == "Child 1" {
			child1Node = node
			break
		}
	}
	if child1Node == nil {
		t.Fatal("Child 1 not found in root's children")
	}
	// Child 1 should now have Child 2 as its child
	grandchildren := child1Node["children"].([]interface{})
	if len(grandchildren) != 1 {
		t.Errorf("child1 children count = %d, want 1", len(grandchildren))
	}
	if grandchildren[0].(map[string]interface{})["title"] != "Child 2" {
		t.Errorf("child1's child = %v, want 'Child 2'", grandchildren[0].(map[string]interface{})["title"])
	}
}

// --- Copy topic to workbook test ---

func TestCreateTopicValidation(t *testing.T) {
	router, s := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Topic Test"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)
	sheets := wb["sheets"].([]interface{})
	sheet := sheets[0].(map[string]interface{})
	rootTopic := sheet["root_topic"].(map[string]interface{})
	rootID := rootTopic["id"].(string)

	tests := []struct {
		name     string
		body     map[string]string
		wantCode int
	}{
		{"valid child", map[string]string{"title": "Child", "parent_id": rootID}, 201},
		{"missing title", map[string]string{"parent_id": rootID}, 201},
		{"missing parent", map[string]string{"title": "Orphan"}, 404},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", tc.body))
			if w.Code != tc.wantCode {
				t.Errorf("status = %d, want %d, body=%s", w.Code, tc.wantCode, w.Body.String())
			}
		})
	}
	_ = s
}

func TestUpdateTopicNonexistent(t *testing.T) {
	router, s := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	updW := httptest.NewRecorder()
	router.ServeHTTP(updW, requestJSON(t, "PUT", "/api/v1/workbooks/"+wbID+"/topics/nonexistent", map[string]string{"title": "Nope"}))
	if updW.Code != http.StatusNotFound {
		t.Errorf("update nonexistent: status=%d, want %d", updW.Code, http.StatusNotFound)
	}
	_ = s
}

func TestDeleteTopicNonexistent(t *testing.T) {
	router, s := newTestRouter(t)

	createW := httptest.NewRecorder()
	router.ServeHTTP(createW, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(createW.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, requestJSON(t, "DELETE", "/api/v1/workbooks/"+wbID+"/topics/nonexistent", nil))
	if delW.Code != http.StatusNotFound {
		t.Errorf("delete nonexistent: status=%d, want %d", delW.Code, http.StatusNotFound)
	}
	_ = s
}

func TestCopyTopicToWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)

	// Create two workbooks
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Source"}))
	var srcWb map[string]interface{}
	json.Unmarshal(w1.Body.Bytes(), &srcWb)
	srcID := srcWb["id"].(string)

	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Target"}))
	var tgtWb map[string]interface{}
	json.Unmarshal(w2.Body.Bytes(), &tgtWb)
	tgtID := tgtWb["id"].(string)

	// Get root topic from source
	srcSheets := srcWb["sheets"].([]interface{})
	srcSheet := srcSheets[0].(map[string]interface{})
	srcRoot := srcSheet["root_topic"].(map[string]interface{})
	srcRootID := srcRoot["id"].(string)

	// Copy root topic to target workbook
	copyW := httptest.NewRecorder()
	router.ServeHTTP(copyW, requestJSON(t, "POST", "/api/v1/workbooks/"+srcID+"/topics/"+srcRootID+"/copy-to-workbook", map[string]string{
		"target_workbook_id": tgtID,
	}))
	if copyW.Code != http.StatusOK {
		t.Fatalf("copy topic: status=%d, body=%s", copyW.Code, copyW.Body.String())
	}

	var copied map[string]interface{}
	json.Unmarshal(copyW.Body.Bytes(), &copied)
	if copied["title"] != srcRoot["title"] {
		t.Errorf("copied title = %v, want %v", copied["title"], srcRoot["title"])
	}
}
