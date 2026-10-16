import { common } from '@kit.AbilityKit';
import { BackupFileHandler } from './BackupFileHandler';
import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { MyASCFRuntime } from 'myascf_runtime';

@Entry
@Component
struct Index {
  private controller: webview.WebviewController = new webview.WebviewController();
  private runtime: MyASCFRuntime = new MyASCFRuntime(this.controller, getContext(this));

  private backupHandler: BackupFileHandler = new BackupFileHandler(getContext(this) as common.UIAbilityContext);
  private backupRegistered: boolean = false;

  aboutToAppear(): void {
    if (!this.backupRegistered) {
      this.runtime.registerCustomApi('app.backup.saveFile', this.backupHandler, {
        title: '保存待办备份', description: '由系统选择器选择位置并保存 JSON', paramsText: 'text: string'
      });
      this.runtime.registerCustomApi('app.backup.openFile', this.backupHandler, {
        title: '读取待办备份', description: '读取用户选定的 JSON 文件，待预览确认', paramsText: '-'
      });
      this.backupRegistered = true;
    }
  }
  build() {
    Column() {
      Web({ src: $rawfile('web/index.html'), controller: this.controller })
        .javaScriptAccess(true)
        .javaScriptProxy({
          object: this.runtime.getNativeProxy(),
          name: this.runtime.getProxyName(),
          methodList: this.runtime.getMethodList(),
          controller: this.controller
        })
        .onPageEnd(() => {
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
