import { picker, fileIo as fs } from '@kit.CoreFileKit';
import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { BusinessError } from '@kit.BasicServicesKit';
import { BridgeHandler, BridgeRequest, BridgeResponse, BridgeResponseData } from 'myascf_runtime';

interface FileResult extends BridgeResponseData { cancelled: boolean; text?: string }

const LIMIT: number = 1024 * 1024;

export class BackupFileHandler implements BridgeHandler {
  private busy: boolean = false;
  private context: common.UIAbilityContext;
  constructor(context: common.UIAbilityContext) {
    this.context = context;
  }

  async handle(request: BridgeRequest): Promise<BridgeResponse> {
    if (this.busy) {
      return { requestId: request.requestId, code: 2012, message: '已有文件操作，请先关闭当前系统选择器' };
    }
    this.busy = true;
    try {
      if (!canIUse('SystemCapability.FileManagement.UserFileService')) throw new Error('此设备不支持系统文件选择器');
      let data: FileResult;
      if (request.action === 'app.backup.saveFile') {
        if (!request.params || typeof request.params.text !== 'string' || request.params.text.length === 0)
          throw new Error('备份文本为空');
        const bytes = new util.TextEncoder().encodeInto(request.params.text);
        if (bytes.byteLength > LIMIT) throw new Error('备份不能超过 1 MiB');
        JSON.parse(request.params.text);
        const options = new picker.DocumentSaveOptions();
        options.newFileNames = ['runtime-todo-' + Date.now().toString() + '.json'];
        options.fileSuffixChoices = ['JSON|.json'];
        const uris = await new picker.DocumentViewPicker(this.context).save(options);
        if (uris.length === 0) data = { cancelled: true };
        else {
          this.write(uris[0], bytes);
          data = { cancelled: false };
        }
      } else {
        const options = new picker.DocumentSelectOptions();
        options.maxSelectNumber = 1;
        options.fileSuffixFilters = ['JSON|.json'];
        const uris = await new picker.DocumentViewPicker(this.context).select(options);
        if (uris.length === 0) data = { cancelled: true };
        else data = { cancelled: false, text: this.read(uris[0]) };
      }
      return { requestId: request.requestId, code: 0, message: 'ok', data: data };
    } catch (error) {
      const failure = error as BusinessError;
      return { requestId: request.requestId, code: 2011, message: failure.message || '文件操作失败' };
    } finally { this.busy = false; }
  }

  private write(uri: string, bytes: Uint8Array): void {
    const file = fs.openSync(uri, fs.OpenMode.READ_WRITE | fs.OpenMode.TRUNC);
    try {
      let offset = 0;
      while (offset < bytes.byteLength) {
        const block = bytes.slice(offset).buffer as ArrayBuffer;
        const count = fs.writeSync(file.fd, block, { length: block.byteLength });
        if (count <= 0) throw new Error('文件未完整写入');
        offset += count;
      }
      fs.fsyncSync(file.fd);
    } catch (error) {
      throw new Error('保存未完成，目标文件可能不完整，请重新导出：' + (error as Error).message);
    } finally { fs.closeSync(file); }
  }

  private read(uri: string): string {
    const file = fs.openSync(uri, fs.OpenMode.READ_ONLY);
    try {
      if (fs.statSync(file.fd).size > LIMIT) throw new Error('备份不能超过 1 MiB');
      const bytes = new Uint8Array(LIMIT + 1);
      let offset = 0;
      while (offset < bytes.byteLength) {
        const block = new ArrayBuffer(Math.min(65536, bytes.byteLength - offset));
        const count = fs.readSync(file.fd, block, { length: block.byteLength });
        if (count === 0) break;
        bytes.set(new Uint8Array(block, 0, count), offset);
        offset += count;
      }
      if (offset > LIMIT) throw new Error('备份不能超过 1 MiB');
      return new util.TextDecoder('utf-8', { fatal: true }).decodeToString(bytes.slice(0, offset));
    } finally { fs.closeSync(file); }
  }
}
