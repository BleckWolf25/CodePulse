/**
 * @file GOAL-MANAGER.JS
 * 
 * @version 1.0.0
 * @author BleckWolf25
 * @contributors
 * @license MIT
 * 
 * @description
 * Goal Setting and Tracking Manager
 * 
 * Provides comprehensive goal setting, tracking, and achievement
 * functionality with progress visualization and notifications.
 */

// ------------ MAIN
class GoalManager {
  constructor() {
    this.goals = new Map();
    this.goalTypes = {
      productivity: { name: 'Productivity Score', unit: 'points', icon: '🎯' },
      complexity: { name: 'Code Complexity', unit: 'average', icon: '🧩' },
      linesOfCode: { name: 'Lines of Code', unit: 'lines', icon: '📝' },
      commits: { name: 'Daily Commits', unit: 'commits', icon: '💾' },
      testCoverage: { name: 'Test Coverage', unit: '%', icon: '🧪' },
      documentation: { name: 'Documentation', unit: '%', icon: '📚' },
      velocity: { name: 'Development Velocity', unit: 'points', icon: '⚡' },
      codeQuality: { name: 'Code Quality', unit: 'score', icon: '✨' }
    };
    
    this.achievements = new Map();
    this.streaks = new Map();
    
    this.init();
  }

  /**
   * Initialize goal manager
   */
  init() {
    this.loadGoals();
    this.loadAchievements();
    this.createGoalUI();
    this.setupEventListeners();
    this.startProgressTracking();
  }

  /**
   * Create goal management UI
   */
  createGoalUI() {
    const goalPanel = document.createElement('div');
    goalPanel.className = 'goal-panel';
    goalPanel.id = 'goalPanel';
    goalPanel.innerHTML = `
      <div class="goal-panel-header">
        <h3>Goals & Achievements</h3>
        <div class="goal-actions">
          <button class="btn btn-sm btn-primary" onclick="window.goalManager.showCreateGoalModal()">
            + New Goal
          </button>
          <button class="goal-panel-toggle" onclick="window.goalManager.toggleGoalPanel()">
            <span class="toggle-icon">📊</span>
          </button>
        </div>
      </div>
      
      <div class="goal-panel-body">
        <div class="goal-tabs">
          <button class="goal-tab active" data-tab="active">Active Goals</button>
          <button class="goal-tab" data-tab="completed">Completed</button>
          <button class="goal-tab" data-tab="achievements">Achievements</button>
        </div>
        
        <div class="goal-content">
          <div class="goal-tab-content active" id="activeGoals">
            <div class="goals-list"></div>
          </div>
          
          <div class="goal-tab-content" id="completedGoals">
            <div class="goals-list"></div>
          </div>
          
          <div class="goal-tab-content" id="achievements">
            <div class="achievements-list"></div>
          </div>
        </div>
      </div>
    `;

    // Add to dashboard
    const dashboard = document.querySelector('.dashboard-content');
    if (dashboard) {
      dashboard.appendChild(goalPanel);
    }

    this.createGoalModal();
    this.renderGoals();
    this.renderAchievements();
  }

  /**
   * Create goal creation modal
   */
  createGoalModal() {
    const modal = document.createElement('div');
    modal.className = 'goal-modal';
    modal.id = 'goalModal';
    modal.innerHTML = `
      <div class="goal-modal-content">
        <div class="goal-modal-header">
          <h3>Create New Goal</h3>
          <button class="close-goal-modal" onclick="window.goalManager.closeGoalModal()">&times;</button>
        </div>
        
        <div class="goal-modal-body">
          <form id="goalForm">
            <div class="form-group">
              <label for="goalType">Goal Type</label>
              <select id="goalType" name="type" required>
                ${Object.entries(this.goalTypes).map(([key, type]) => 
                  `<option value="${key}">${type.icon} ${type.name}</option>`
                ).join('')}
              </select>
            </div>
            
            <div class="form-group">
              <label for="goalTitle">Goal Title</label>
              <input type="text" id="goalTitle" name="title" required placeholder="Enter goal title">
            </div>
            
            <div class="form-group">
              <label for="goalDescription">Description</label>
              <textarea id="goalDescription" name="description" placeholder="Describe your goal"></textarea>
            </div>
            
            <div class="form-row">
              <div class="form-group">
                <label for="goalTarget">Target Value</label>
                <input type="number" id="goalTarget" name="target" required min="0" step="0.1">
              </div>
              
              <div class="form-group">
                <label for="goalPeriod">Time Period</label>
                <select id="goalPeriod" name="period" required>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            
            <div class="form-group">
              <label for="goalDeadline">Deadline (Optional)</label>
              <input type="date" id="goalDeadline" name="deadline">
            </div>
            
            <div class="form-group">
              <label for="goalPriority">Priority</label>
              <select id="goalPriority" name="priority">
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            
            <div class="form-group">
              <label>
                <input type="checkbox" name="notifications" checked>
                Enable progress notifications
              </label>
            </div>
          </form>
        </div>
        
        <div class="goal-modal-footer">
          <button class="btn btn-secondary" onclick="window.goalManager.closeGoalModal()">Cancel</button>
          <button class="btn btn-primary" onclick="window.goalManager.createGoal()">Create Goal</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Goal tab switching
    document.addEventListener('click', (e) => {
      if (e.target.matches('.goal-tab')) {
        this.switchGoalTab(e.target.dataset.tab);
      }
    });

    // Goal actions
    document.addEventListener('click', (e) => {
      if (e.target.matches('.goal-action')) {
        const action = e.target.dataset.action;
        const goalId = e.target.dataset.goalId;
        this.handleGoalAction(action, goalId);
      }
    });

    // Form changes
    document.addEventListener('change', (e) => {
      if (e.target.matches('#goalType')) {
        this.updateGoalFormForType(e.target.value);
      }
    });
  }

  /**
   * Show create goal modal
   */
  showCreateGoalModal() {
    const modal = document.getElementById('goalModal');
    if (modal) {
      modal.classList.add('show');
      this.resetGoalForm();
    }
  }

  /**
   * Close goal modal
   */
  closeGoalModal() {
    const modal = document.getElementById('goalModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  /**
   * Create new goal
   */
  createGoal() {
    const form = document.getElementById('goalForm');
    const formData = new FormData(form);
    
    const goal = {
      id: this.generateGoalId(),
      type: formData.get('type'),
      title: formData.get('title'),
      description: formData.get('description'),
      target: parseFloat(formData.get('target')),
      period: formData.get('period'),
      deadline: formData.get('deadline') || null,
      priority: formData.get('priority'),
      notifications: formData.has('notifications'),
      createdAt: new Date().toISOString(),
      status: 'active',
      progress: 0,
      currentValue: 0,
      history: []
    };

    // Validate goal
    if (!this.validateGoal(goal)) {
      return;
    }

    this.goals.set(goal.id, goal);
    this.saveGoals();
    this.renderGoals();
    this.closeGoalModal();
    
    this.showNotification(`Goal "${goal.title}" created successfully!`, 'success');
  }

  /**
   * Validate goal data
   */
  validateGoal(goal) {
    if (!goal.title || goal.title.trim().length === 0) {
      this.showNotification('Goal title is required', 'error');
      return false;
    }

    if (!goal.target || goal.target <= 0) {
      this.showNotification('Target value must be greater than 0', 'error');
      return false;
    }

    if (goal.deadline && new Date(goal.deadline) <= new Date()) {
      this.showNotification('Deadline must be in the future', 'error');
      return false;
    }

    return true;
  }

  /**
   * Update goal progress
   */
  updateGoalProgress(goalId, currentValue) {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    const previousValue = goal.currentValue;
    goal.currentValue = currentValue;
    goal.progress = Math.min((currentValue / goal.target) * 100, 100);
    
    // Add to history
    goal.history.push({
      date: new Date().toISOString(),
      value: currentValue,
      progress: goal.progress
    });

    // Check for completion
    if (goal.progress >= 100 && goal.status === 'active') {
      this.completeGoal(goalId);
    }

    // Check for milestones
    this.checkMilestones(goal, previousValue);

    this.saveGoals();
    this.renderGoals();
  }

  /**
   * Complete goal
   */
  completeGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.status = 'completed';
    goal.completedAt = new Date().toISOString();
    
    // Create achievement
    this.createAchievement({
      type: 'goal_completed',
      title: `Goal Achieved: ${goal.title}`,
      description: `Successfully completed goal "${goal.title}"`,
      goalId: goalId,
      earnedAt: new Date().toISOString()
    });

    this.showNotification(`🎉 Congratulations! Goal "${goal.title}" completed!`, 'success');
    this.saveGoals();
    this.renderGoals();
  }

  /**
   * Check for milestones
   */
  checkMilestones(goal, previousValue) {
    const milestones = [25, 50, 75, 90];
    
    milestones.forEach(milestone => {
      const previousProgress = (previousValue / goal.target) * 100;
      
      if (goal.progress >= milestone && previousProgress < milestone) {
        this.createAchievement({
          type: 'milestone',
          title: `${milestone}% Progress`,
          description: `Reached ${milestone}% progress on "${goal.title}"`,
          goalId: goal.id,
          milestone: milestone,
          earnedAt: new Date().toISOString()
        });

        if (goal.notifications) {
          this.showNotification(`🎯 ${milestone}% progress on "${goal.title}"!`, 'info');
        }
      }
    });
  }

  /**
   * Create achievement
   */
  createAchievement(achievement) {
    achievement.id = this.generateAchievementId();
    this.achievements.set(achievement.id, achievement);
    this.saveAchievements();
    this.renderAchievements();
  }

  /**
   * Render goals
   */
  renderGoals() {
    const activeContainer = document.querySelector('#activeGoals .goals-list');
    const completedContainer = document.querySelector('#completedGoals .goals-list');
    
    if (!activeContainer || !completedContainer) return;

    const activeGoals = Array.from(this.goals.values()).filter(g => g.status === 'active');
    const completedGoals = Array.from(this.goals.values()).filter(g => g.status === 'completed');

    activeContainer.innerHTML = activeGoals.length > 0 
      ? activeGoals.map(goal => this.renderGoalCard(goal)).join('')
      : '<div class="empty-state">No active goals. Create your first goal!</div>';

    completedContainer.innerHTML = completedGoals.length > 0
      ? completedGoals.map(goal => this.renderGoalCard(goal)).join('')
      : '<div class="empty-state">No completed goals yet.</div>';
  }

  /**
   * Render goal card
   */
  renderGoalCard(goal) {
    const goalType = this.goalTypes[goal.type];
    const isOverdue = goal.deadline && new Date(goal.deadline) < new Date() && goal.status === 'active';
    const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24)) : null;

    return `
      <div class="goal-card ${goal.priority} ${isOverdue ? 'overdue' : ''}" data-goal-id="${goal.id}">
        <div class="goal-header">
          <div class="goal-icon">${goalType.icon}</div>
          <div class="goal-info">
            <h4 class="goal-title">${goal.title}</h4>
            <p class="goal-description">${goal.description || ''}</p>
          </div>
          <div class="goal-actions">
            ${goal.status === 'active' ? `
              <button class="goal-action" data-action="edit" data-goal-id="${goal.id}" title="Edit Goal">✏️</button>
              <button class="goal-action" data-action="complete" data-goal-id="${goal.id}" title="Mark Complete">✅</button>
            ` : ''}
            <button class="goal-action" data-action="delete" data-goal-id="${goal.id}" title="Delete Goal">🗑️</button>
          </div>
        </div>
        
        <div class="goal-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${goal.progress}%"></div>
          </div>
          <div class="progress-text">
            ${goal.currentValue} / ${goal.target} ${goalType.unit} (${Math.round(goal.progress)}%)
          </div>
        </div>
        
        <div class="goal-meta">
          <span class="goal-period">${goal.period}</span>
          <span class="goal-priority priority-${goal.priority}">${goal.priority}</span>
          ${goal.deadline ? `
            <span class="goal-deadline ${isOverdue ? 'overdue' : ''}">
              ${isOverdue ? 'Overdue' : daysLeft > 0 ? `${daysLeft} days left` : 'Due today'}
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render achievements
   */
  renderAchievements() {
    const container = document.querySelector('#achievements .achievements-list');
    if (!container) return;

    const achievementsList = Array.from(this.achievements.values())
      .sort((a, b) => new Date(b.earnedAt) - new Date(a.earnedAt));

    container.innerHTML = achievementsList.length > 0
      ? achievementsList.map(achievement => this.renderAchievementCard(achievement)).join('')
      : '<div class="empty-state">No achievements yet. Complete goals to earn achievements!</div>';
  }

  /**
   * Render achievement card
   */
  renderAchievementCard(achievement) {
    const earnedDate = new Date(achievement.earnedAt).toLocaleDateString();
    
    return `
      <div class="achievement-card ${achievement.type}">
        <div class="achievement-icon">🏆</div>
        <div class="achievement-info">
          <h4 class="achievement-title">${achievement.title}</h4>
          <p class="achievement-description">${achievement.description}</p>
          <span class="achievement-date">Earned on ${earnedDate}</span>
        </div>
      </div>
    `;
  }

  /**
   * Switch goal tab
   */
  switchGoalTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.goal-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.goal-tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Goals` || content.id === tabName);
    });
  }

  /**
   * Handle goal actions
   */
  handleGoalAction(action, goalId) {
    switch (action) {
      case 'edit':
        this.editGoal(goalId);
        break;
      case 'complete':
        this.completeGoal(goalId);
        break;
      case 'delete':
        this.deleteGoal(goalId);
        break;
    }
  }

  /**
   * Delete goal
   */
  deleteGoal(goalId) {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    if (confirm(`Are you sure you want to delete the goal "${goal.title}"?`)) {
      this.goals.delete(goalId);
      this.saveGoals();
      this.renderGoals();
      this.showNotification('Goal deleted successfully', 'info');
    }
  }

  /**
   * Start progress tracking
   */
  startProgressTracking() {
    // Update goal progress based on current metrics
    setInterval(() => {
      this.updateGoalsFromMetrics();
    }, 60000); // Update every minute

    // Initial update
    this.updateGoalsFromMetrics();
  }

  /**
   * Update goals from current metrics
   */
  updateGoalsFromMetrics() {
    // This would integrate with the actual metrics system
    // TODO: For now, simulate progress updates
    this.goals.forEach(goal => {
      if (goal.status === 'active') {
        // Simulate progress based on goal type
        const simulatedValue = this.getSimulatedMetricValue(goal.type);
        if (simulatedValue !== null) {
          this.updateGoalProgress(goal.id, simulatedValue);
        }
      }
    });
  }

  /**
   * Get metric value (TODO: Would be replaced with real metrics)
   */
  getSimulatedMetricValue(goalType) {
    // This would integrate with actual dashboard metrics
    const simulations = {
      productivity: Math.random() * 100,
      complexity: Math.random() * 20,
      linesOfCode: Math.random() * 1000,
      commits: Math.random() * 10,
      testCoverage: Math.random() * 100,
      documentation: Math.random() * 100
    };

    return simulations[goalType] || null;
  }

  /**
   * Generate unique goal ID
   */
  generateGoalId() {
    return 'goal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Generate unique achievement ID
   */
  generateAchievementId() {
    return 'achievement_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Save goals to localStorage
   */
  saveGoals() {
    localStorage.setItem('codePulse_goals', JSON.stringify(Array.from(this.goals.entries())));
  }

  /**
   * Load goals from localStorage
   */
  loadGoals() {
    try {
      const saved = localStorage.getItem('codePulse_goals');
      if (saved) {
        const goalsArray = JSON.parse(saved);
        this.goals = new Map(goalsArray);
      }
    } catch (error) {
      console.warn('Failed to load goals:', error);
    }
  }

  /**
   * Save achievements to localStorage
   */
  saveAchievements() {
    localStorage.setItem('codePulse_achievements', JSON.stringify(Array.from(this.achievements.entries())));
  }

  /**
   * Load achievements from localStorage
   */
  loadAchievements() {
    try {
      const saved = localStorage.getItem('codePulse_achievements');
      if (saved) {
        const achievementsArray = JSON.parse(saved);
        this.achievements = new Map(achievementsArray);
      }
    } catch (error) {
      console.warn('Failed to load achievements:', error);
    }
  }

  /**
   * Show notification
   */
  showNotification(message, type) {
    if (window.dashboardManager) {
      window.dashboardManager.showNotification(message, type);
    }
  }

  /**
   * Toggle goal panel
   */
  toggleGoalPanel() {
    const panel = document.getElementById('goalPanel');
    if (panel) {
      panel.classList.toggle('collapsed');
    }
  }
}
