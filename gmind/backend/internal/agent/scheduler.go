package agent

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/gmind/backend/internal/core"
	"github.com/gmind/backend/internal/model"
	"github.com/gmind/backend/internal/store"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	store      *store.ScheduledTaskStore
	queue      *TaskQueue
	workerPool *WorkerPool
	logger     core.Logger
	eventBus   core.EventBus
	mu         sync.Mutex
	stop       context.CancelFunc
}

func NewScheduler(
	store *store.ScheduledTaskStore,
	queue *TaskQueue,
	pool *WorkerPool,
	logger core.Logger,
	eventBus core.EventBus,
) *Scheduler {
	return &Scheduler{
		store:      store,
		queue:      queue,
		workerPool: pool,
		logger:     logger,
		eventBus:   eventBus,
	}
}

func (s *Scheduler) Start(ctx context.Context) error {
	ctx, cancel := context.WithCancel(ctx)
	s.mu.Lock()
	s.stop = cancel
	s.mu.Unlock()

	s.logger.Info("scheduler started")
	s.checkDueTasks(ctx)

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("scheduler stopped")
			return nil
		case <-ticker.C:
			s.checkDueTasks(ctx)
		}
	}
}

func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.stop != nil {
		s.stop()
	}
}

func (s *Scheduler) checkDueTasks(ctx context.Context) {
	tasks, err := s.store.GetDueTasks(time.Now().UTC())
	if err != nil {
		s.logger.Error("failed to get due tasks", "error", err)
		return
	}
	for _, t := range tasks {
		s.dispatchTask(ctx, t)
	}
}

func (s *Scheduler) dispatchTask(ctx context.Context, t *model.ScheduledTask) {
	nextRun, err := s.nextRun(t.CronExpression, t.LastRunAt)
	if err != nil {
		s.logger.Error("invalid cron for scheduled task", "task_id", t.ID, "cron", t.CronExpression, "error", err)
		return
	}

	s.logger.Info("dispatching scheduled task", "task_id", t.ID, "agent_id", t.AgentID)

	if s.workerPool != nil {
		s.workerPool.SubmitScheduled(t)
	}

	now := time.Now().UTC()
	_ = s.store.UpdateLastRun(t.ID, now)
	_ = s.store.UpdateNextRun(t.ID, nextRun)

	if s.eventBus != nil {
		s.eventBus.Publish(core.Event{
			Type:   "agent:scheduled_task:dispatched",
			Source: "scheduler",
			Payload: map[string]any{
				"task_id":  t.ID,
				"agent_id": t.AgentID,
				"cron":     t.CronExpression,
			},
		})
	}
}

func (s *Scheduler) nextRun(expr string, lastRun time.Time) (time.Time, error) {
	if lastRun.IsZero() {
		lastRun = time.Now().UTC()
	}
	p := cron.NewParser(cron.Second | cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)
	schedule, err := p.Parse(expr)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse cron %q: %w", expr, err)
	}
	return schedule.Next(lastRun), nil
}
