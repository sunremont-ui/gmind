package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAddCollaboratorNoWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks/nonexistent/collaborators", map[string]string{
		"user_id": "user1",
	}))
	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d, body=%s", w.Code, http.StatusNotFound, w.Body.String())
	}
}

func TestAddAndListCollaborators(t *testing.T) {
	router, s := newTestRouter(t)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	addW := httptest.NewRecorder()
	router.ServeHTTP(addW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/collaborators", map[string]string{
		"user_id": "collab-1",
		"role":    "editor",
	}))
	if addW.Code != http.StatusOK && addW.Code != http.StatusCreated {
		t.Errorf("add collaborator: status=%d", addW.Code)
	}

	listW := httptest.NewRecorder()
	router.ServeHTTP(listW, requestJSON(t, "GET", "/api/v1/workbooks/"+wbID+"/collaborators", nil))
	if listW.Code != http.StatusOK {
		t.Errorf("list collaborators: status=%d", listW.Code)
	}
	var resp map[string]interface{}
	json.Unmarshal(listW.Body.Bytes(), &resp)
	users := resp["users"].([]interface{})
	if len(users) != 1 || users[0].(string) != "collab-1" {
		t.Errorf("collaborators = %v, want [collab-1]", users)
	}

	// Verify add with missing user_id returns bad request
	badW := httptest.NewRecorder()
	router.ServeHTTP(badW, requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/collaborators", map[string]string{
		"role": "viewer",
	}))
	if badW.Code != http.StatusBadRequest {
		t.Errorf("missing user_id: status=%d, want %d", badW.Code, http.StatusBadRequest)
	}
	_ = s
}

func TestRemoveCollaborator(t *testing.T) {
	router, s := newTestRouter(t)

	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "POST", "/api/v1/workbooks", map[string]string{"title": "WB"}))
	var wb map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &wb)
	wbID := wb["id"].(string)

	router.ServeHTTP(httptest.NewRecorder(), requestJSON(t, "POST", "/api/v1/workbooks/"+wbID+"/collaborators", map[string]string{
		"user_id": "user-to-remove",
	}))

	delW := httptest.NewRecorder()
	router.ServeHTTP(delW, requestJSON(t, "DELETE", "/api/v1/workbooks/"+wbID+"/collaborators/user-to-remove", nil))
	if delW.Code != http.StatusNoContent && delW.Code != http.StatusOK {
		t.Errorf("remove collaborator: status=%d", delW.Code)
	}

	listW := httptest.NewRecorder()
	router.ServeHTTP(listW, requestJSON(t, "GET", "/api/v1/workbooks/"+wbID+"/collaborators", nil))
	var resp map[string]interface{}
	json.Unmarshal(listW.Body.Bytes(), &resp)
	users, _ := resp["users"].([]interface{})
	if len(users) != 0 {
		t.Errorf("after removal: collaborators = %v, want []", users)
	}
	_ = s
}

func TestListCollaboratorsNoWorkbook(t *testing.T) {
	router, _ := newTestRouter(t)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, requestJSON(t, "GET", "/api/v1/workbooks/nonexistent/collaborators", nil))
	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want %d, body=%s", w.Code, http.StatusOK, w.Body.String())
	}
	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	users, ok := resp["users"].([]interface{})
	if !ok || len(users) != 0 {
		t.Errorf("expected empty users for nonexistent workbook, got %v", resp)
	}
}
