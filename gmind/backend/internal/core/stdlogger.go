package core

import (
	"log"
)

type stdLogger struct{}

// NewStdLogger creates a Logger backed by the standard library logger.
func NewStdLogger() Logger {
	return &stdLogger{}
}

func (l *stdLogger) Info(msg string, args ...any) {
	log.Println("[INFO]", msg, args)
}

func (l *stdLogger) Warn(msg string, args ...any) {
	log.Println("[WARN]", msg, args)
}

func (l *stdLogger) Error(msg string, args ...any) {
	log.Println("[ERROR]", msg, args)
}

func (l *stdLogger) Debug(msg string, args ...any) {
	log.Println("[DEBUG]", msg, args)
}
