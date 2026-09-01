package api

import (
	"testing"
)

func TestLabEntryNodeTitleKeepsStatementWhole(t *testing.T) {
	long := "Реестр лабы в Gmind хранит только пути к каталогам: трек, namespace и оракул " +
		"читаются из lab.config.json проекта, а сам реестр служит allowlist'ом"
	got := labEntryNodeTitle(labEntryLite{Kind: "decision", Statement: long})
	// Утверждение не режется: обрезанное на карте читалось бы как ДРУГОЕ
	// утверждение, а узел умеет расти под текст.
	if !contains(got, long) {
		t.Errorf("утверждение обрезано: %q", got)
	}
	if !contains(got, "◆") {
		t.Errorf("вид записи не виден в заголовке: %q", got)
	}
}

func TestLabEntryNodeTitleFallsBackForUnknownKind(t *testing.T) {
	got := labEntryNodeTitle(labEntryLite{Kind: "выдуманный", Statement: "нечто"})
	if !contains(got, "• нечто") {
		t.Errorf("неизвестный вид получил не тот значок: %q", got)
	}
}

func TestLabEntryNotesCarryVerdictAndRef(t *testing.T) {
	notes := labEntryNotes(labEntryLite{
		Status: "accepted", LastVerdict: "drift", SourceRef: "git:abc1234:gmind/PLANS.md",
	})
	for _, want := range []string{"accepted", "drift", "git:abc1234:gmind/PLANS.md"} {
		if !contains(notes, want) {
			t.Errorf("в заметке нет %q: %q", want, notes)
		}
	}
	// Запись без вердикта не получает выдуманного.
	plain := labEntryNotes(labEntryLite{Status: "proposed"})
	if contains(plain, "вердикт") {
		t.Errorf("вердикт приписан записи, которую не сверяли: %q", plain)
	}
}

// Все виды записей лабы должны иметь и значок, и подпись группы: вид без них
// молча выпал бы с карты.
func TestEveryLabKindIsDrawable(t *testing.T) {
	kinds := []string{"fact", "decision", "gate", "tail", "next", "lesson"}
	if len(labKindOrder) != len(kinds) {
		t.Fatalf("порядок видов знает %d видов, а их %d", len(labKindOrder), len(kinds))
	}
	for _, k := range kinds {
		if labKindGlyph[k] == "" {
			t.Errorf("у вида %q нет значка", k)
		}
		if labKindTitle[k] == "" {
			t.Errorf("у вида %q нет подписи группы", k)
		}
		found := false
		for _, o := range labKindOrder {
			if o == k {
				found = true
			}
		}
		if !found {
			t.Errorf("вид %q не попал в порядок отрисовки", k)
		}
	}
}

func TestLabProjectNodeTitle(t *testing.T) {
	if got := labProjectNodeTitle(labProject{Track: "GM", Label: "Gmind"}); got != "GM · Gmind" {
		t.Errorf("заголовок проекта = %q", got)
	}
	// Каталог без трека всё равно попадает на карту — под своей подписью.
	if got := labProjectNodeTitle(labProject{Label: "Сломанный"}); got != "Сломанный" {
		t.Errorf("проект без трека = %q", got)
	}
}

func contains(s, sub string) bool {
	return len(sub) == 0 || (len(s) >= len(sub) && indexOf(s, sub) >= 0)
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
