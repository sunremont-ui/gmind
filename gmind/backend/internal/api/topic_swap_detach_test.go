package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// createTopicT creates a topic under parentID and returns its id.
func createTopicT(t *testing.T, router http.Handler, wbID, parentID, title string) string {
	t.Helper()
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics", map[string]string{
		"title":     title,
		"parent_id": parentID,
	}))
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("create topic %q: status=%d body=%s", title, w.Code, w.Body.String())
	}
	var topic map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &topic)
	return topic["id"].(string)
}

// newWorkbookWithRoot creates a workbook and returns (wbID, rootID).
func newWorkbookWithRoot(t *testing.T, router http.Handler) (string, string) {
	t.Helper()
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "Swap/Detach"}))
	var wb map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &wb)
	wbID := wb["id"].(string)
	sheet := wb["sheets"].([]interface{})[0].(map[string]interface{})
	rootID := sheet["root_topic"].(map[string]interface{})["id"].(string)
	return wbID, rootID
}

func fetchRoot(t *testing.T, router http.Handler, wbID string) map[string]interface{} {
	t.Helper()
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/workbooks/"+wbID, nil))
	var wb map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &wb)
	sheet := wb["sheets"].([]interface{})[0].(map[string]interface{})
	return sheet
}

func childIDs(topic map[string]interface{}) []string {
	raw, _ := topic["children"].([]interface{})
	ids := make([]string, 0, len(raw))
	for _, c := range raw {
		ids = append(ids, c.(map[string]interface{})["id"].(string))
	}
	return ids
}

func TestSwapTopics(t *testing.T) {
	router, _ := newTestRouter(t)
	wbID, rootID := newWorkbookWithRoot(t, router)
	aID := createTopicT(t, router, wbID, rootID, "A")
	bID := createTopicT(t, router, wbID, rootID, "B")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics/"+aID+"/swap", map[string]string{
		"other_id": bID,
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("swap: status=%d body=%s", w.Code, w.Body.String())
	}

	sheet := fetchRoot(t, router, wbID)
	root := sheet["root_topic"].(map[string]interface{})
	got := childIDs(root)
	if len(got) != 2 || got[0] != bID || got[1] != aID {
		t.Errorf("after swap want [B A] = [%s %s], got %v", bID, aID, got)
	}
}

func TestSwapTopicsRejectsRoot(t *testing.T) {
	router, _ := newTestRouter(t)
	wbID, rootID := newWorkbookWithRoot(t, router)
	aID := createTopicT(t, router, wbID, rootID, "A")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics/"+aID+"/swap", map[string]string{
		"other_id": rootID,
	}))
	if w.Code != http.StatusBadRequest {
		t.Errorf("swap with root: want 400, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestDetachTopic(t *testing.T) {
	router, _ := newTestRouter(t)
	wbID, rootID := newWorkbookWithRoot(t, router)
	aID := createTopicT(t, router, wbID, rootID, "A")
	gcID := createTopicT(t, router, wbID, aID, "GC")

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics/"+aID+"/detach", map[string]interface{}{
		"position": map[string]float64{"x": 500, "y": 300},
	}))
	if w.Code != http.StatusOK {
		t.Fatalf("detach: status=%d body=%s", w.Code, w.Body.String())
	}

	sheet := fetchRoot(t, router, wbID)
	root := sheet["root_topic"].(map[string]interface{})
	if got := childIDs(root); len(got) != 0 {
		t.Errorf("root should have no children after detach, got %v", got)
	}
	floating, _ := sheet["floating_topics"].([]interface{})
	if len(floating) != 1 {
		t.Fatalf("want 1 floating topic, got %d", len(floating))
	}
	ft := floating[0].(map[string]interface{})
	if ft["id"].(string) != aID {
		t.Errorf("floating id = %v, want %s", ft["id"], aID)
	}
	if kids := childIDs(ft); len(kids) != 1 || kids[0] != gcID {
		t.Errorf("detached subtree lost: want [%s], got %v", gcID, kids)
	}
	pos, _ := ft["position"].(map[string]interface{})
	if pos == nil || pos["x"].(float64) != 500 || pos["y"].(float64) != 300 {
		t.Errorf("floating position = %v, want {500,300}", pos)
	}
}

func TestDetachRootRejected(t *testing.T) {
	router, _ := newTestRouter(t)
	wbID, rootID := newWorkbookWithRoot(t, router)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/topics/"+rootID+"/detach", map[string]interface{}{
		"position": map[string]float64{"x": 1, "y": 2},
	}))
	if w.Code != http.StatusBadRequest {
		t.Errorf("detach root: want 400, got %d body=%s", w.Code, w.Body.String())
	}
}
