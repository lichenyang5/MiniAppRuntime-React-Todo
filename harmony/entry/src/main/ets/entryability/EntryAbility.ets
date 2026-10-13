import { UIAbility, Want, AbilityConstant } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { hilog } from '@kit.PerformanceAnalysisKit';

export default class EntryAbility extends UIAbility {
  private capture(want: Want): void {
    if (want.parameters?.runtimeTodoReminder === true && typeof want.parameters?.todoId === 'string') {
      AppStorage.setOrCreate('todoReminderTarget', JSON.stringify({
        taskId: want.parameters.todoId, token: Date.now()
      }));
    }
  }
  onCreate(want: Want, _launchParam: AbilityConstant.LaunchParam): void { this.capture(want); }
  onNewWant(want: Want, _launchParam: AbilityConstant.LaunchParam): void { this.capture(want); }
  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (error) => {
      if (error.code) hilog.error(0x1200, 'MyASCFDemo', 'loadContent failed: %{public}s', error.message);
    });
  }
}
