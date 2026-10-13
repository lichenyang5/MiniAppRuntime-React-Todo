import { common } from '@kit.AbilityKit';
import { TodoReminderProxy } from './TodoReminderProxy';
import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { MyASCFRuntime } from 'myascf_runtime';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private runtime: MyASCFRuntime = new MyASCFRuntime(this.controller, getContext(this));

  private proxy: TodoReminderProxy = new TodoReminderProxy(this.runtime, this.controller, getContext(this) as common.UIAbilityContext);
  @StorageLink('todoReminderTarget') @Watch('dispatchTarget') target: string = '';
  private dispatchTarget(): void {
    this.controller.runJavaScript('window.__todoReminderOpen__=' + JSON.stringify(this.target) + ';window.dispatchEvent(new Event("todo-reminder-open"))')
      .catch((_error: Error) => {});
  }
  build() {
    Column() {
      Web({ src: $rawfile('web/index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .javaScriptProxy({
          object: this.proxy,
          name: this.runtime.getProxyName(),
          methodList: this.runtime.getMethodList(),
          controller: this.controller
        })
        .onPageEnd(() => {
          this.dispatchTarget();
          this.controller.runJavaScript('JSON.stringify({sdk:typeof window.myascf,native:typeof window.MyASCFNative,postMessage:typeof window.MyASCFNative?.postMessage,callback:typeof window.__myascf_on_native_response__})')
            .then((result: string) => hilog.info(0x1200, 'MyASCFDemo', '%{public}s', result))
            .catch((error: Error) => hilog.error(0x1200, 'MyASCFDemo', '%{public}s', error.message));
        })
        .width('100%')
        .height('100%');
    }
    .width('100%')
    .height('100%');
  }
}
