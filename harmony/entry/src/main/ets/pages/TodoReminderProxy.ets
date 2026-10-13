import { reminderAgentManager } from '@kit.BackgroundTasksKit';
import { notificationManager } from '@kit.NotificationKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { common } from '@kit.AbilityKit';
import { webview } from '@kit.ArkWeb';
import { MyASCFRuntime } from 'myascf_runtime';

interface Params { taskId?: string; title?: string; atMs?: number }
interface Request { requestId: string; action: string; params: Params }
interface TaskReminder { taskId: string; title: string; atMs: number }
interface Status { supported: boolean; notificationEnabled: boolean; reminders: TaskReminder[] }
interface Response { requestId: string; code: number; message: string; data?: Status }

export class TodoReminderProxy {
  private queue: Promise<void> = Promise.resolve();
  private runtime: MyASCFRuntime;
  private controller: webview.WebviewController;
  private context: common.UIAbilityContext;
  constructor(runtime: MyASCFRuntime, controller: webview.WebviewController, context: common.UIAbilityContext) {
    this.runtime = runtime; this.controller = controller; this.context = context;
  }

  postMessage(raw: string): void {
    let request: Request;
    try { request = JSON.parse(raw) as Request; } catch (_) { this.runtime.getNativeProxy().postMessage(raw); return; }
    if (!['app.reminder.status', 'app.reminder.requestPermission', 'app.reminder.schedule', 'app.reminder.cancel'].includes(request.action)) {
      this.runtime.getNativeProxy().postMessage(raw); return;
    }
    this.queue = this.queue.then(async () => {
      let response: Response;
      try {
        const data = await this.handle(request);
        response = { requestId: request.requestId, code: 0, message: 'ok', data: data };
      } catch (error) {
        const nativeError = error as BusinessError;
        response = { requestId: request.requestId, code: nativeError.code || 2010,
          message: nativeError.code === 1700002 ?
            '代理提醒创建被系统拒绝（1700002）。请确认此包名已在华为开发者平台开通代理提醒能力，并更新签名 Profile；也需核对提醒数量。' :
            nativeError.message || '原生提醒操作失败' };
      }
      try {
        await this.controller.runJavaScript('window.__myascf_on_native_response__?.(' + JSON.stringify(response) + ')');
      } catch (_) { /* The next page can query the OS for the final outcome. */ }
    });
  }

  private async ownReminders(): Promise<reminderAgentManager.ReminderInfo[]> {
    const all = await reminderAgentManager.getAllValidReminders();
    return all.filter((item: reminderAgentManager.ReminderInfo) =>
      item.reminderReq.wantAgent?.parameters?.runtimeTodoReminder === true);
  }

  private async status(): Promise<Status> {
    const supported = canIUse('SystemCapability.Notification.ReminderAgent');
    if (!supported) return { supported: false, notificationEnabled: false, reminders: [] };
    const all = await this.ownReminders();
    const reminders: TaskReminder[] = [];
    all.forEach((item: reminderAgentManager.ReminderInfo) => {
      const params = item.reminderReq.wantAgent?.parameters;
      if (params && typeof params.todoId === 'string' && typeof params.todoTitle === 'string' &&
        typeof params.todoReminderAt === 'number') {
        reminders.push({ taskId: params.todoId as string, title: params.todoTitle as string,
          atMs: params.todoReminderAt as number });
      }
    });
    return { supported: true, notificationEnabled: await notificationManager.isNotificationEnabled(), reminders: reminders };
  }

  private async handle(request: Request): Promise<Status> {
    const state = await this.status();
    if (request.action === 'app.reminder.status') return state;
    if (!state.supported) throw new Error('此设备不支持后台代理提醒');
    if (request.action === 'app.reminder.requestPermission') {
      await notificationManager.requestEnableNotification(this.context);
      return await this.status();
    }
    const params = request.params;
    if (!params || typeof params.taskId !== 'string' || params.taskId.length === 0 || params.taskId.length > 128)
      throw new Error('待办标识无效');
    const existing = (await this.ownReminders()).filter((item: reminderAgentManager.ReminderInfo) =>
      item.reminderReq.wantAgent?.parameters?.todoId === params.taskId);
    if (request.action === 'app.reminder.cancel') {
      for (const item of existing) {
        try { await reminderAgentManager.cancelReminder(item.reminderId); }
        catch (error) { if ((error as BusinessError).code !== 1700003) throw new Error((error as BusinessError).message); }
      }
      return await this.status();
    }
    if (!state.notificationEnabled) throw new Error('请先开启应用通知');
    if (typeof params.title !== 'string' || !params.title.trim() || params.title.length > 120 ||
      typeof params.atMs !== 'number' || !Number.isFinite(params.atMs) ||
      params.atMs % 60000 !== 0 || params.atMs < Date.now() + 60000)
      throw new Error('请输入内容和至少一分钟后的提醒时间');
    if (existing.length > 0) {
      if (existing.length === 1 && existing[0].reminderReq.wantAgent?.parameters?.todoReminderAt === params.atMs &&
        existing[0].reminderReq.wantAgent?.parameters?.todoTitle === params.title) return state;
      throw new Error('该待办已有提醒，请先取消再重新设置');
    }
    const time = new Date(params.atMs);
    if (time.getFullYear() > 9999 || time.getFullYear() < 1) throw new Error('提醒日期超出支持范围');
    const all = await reminderAgentManager.getAllValidReminders();
    let notificationId = Math.floor(Date.now() % 2147483646) + 1;
    while (all.some((item: reminderAgentManager.ReminderInfo) => item.reminderReq.notificationId === notificationId)) {
      notificationId = notificationId % 2147483646 + 1;
    }
    const reminder: reminderAgentManager.ReminderRequestCalendar = {
      reminderType: reminderAgentManager.ReminderType.REMINDER_TYPE_CALENDAR,
      dateTime: { year: time.getFullYear(), month: time.getMonth() + 1, day: time.getDate(),
        hour: time.getHours(), minute: time.getMinutes(), second: 0 },
      title: '待办提醒', content: params.title, expiredContent: params.title,
      notificationId: notificationId,
      slotType: notificationManager.SlotType.SOCIAL_COMMUNICATION,
      tapDismissed: true, snoozeTimes: 0,
      wantAgent: { pkgName: this.context.abilityInfo.bundleName, abilityName: this.context.abilityInfo.name,
        parameters: { runtimeTodoReminder: true, todoId: params.taskId,
          todoTitle: params.title, todoReminderAt: params.atMs } }
    };
    await reminderAgentManager.publishReminder(reminder);
    return await this.status();
  }
}
