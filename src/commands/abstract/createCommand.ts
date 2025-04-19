import { Uri, window } from 'vscode';
import logger from '../../logger';
import { reportError } from '../../helper';
import { handleCtxFromUri, allHandleCtxFromUri, FileHandlerContext } from '../../fileHandlers';
import Command from './command';

interface BaseCommandOption {
  id: string;
  name?: string;
}

interface CommandOption extends BaseCommandOption {
  handleCommand: (this: Command, ...args: any[]) => unknown | Promise<unknown>;
}

interface FileCommandOption extends BaseCommandOption {
  handleFile: (ctx: FileHandlerContext) => Promise<unknown>;
  getFileTarget: (...args: any[]) => undefined | Uri | Uri[] | Promise<undefined | Uri | Uri[]>;
}

function checkType<T>() {
  return (a: T) => a;
}

export const checkCommand = checkType<CommandOption>();
export const checkFileCommand = checkType<FileCommandOption>();

export function createCommand(commandOption: CommandOption & { name: string }) {
  return class NormalCommand extends Command {
    constructor() {
      super();
      this.id = commandOption.id;
      this.name = commandOption.name;
    }

    doCommandRun(...args) {
      commandOption.handleCommand.apply(this, args);
    }
  };
}

export function createFileCommand(commandOption: FileCommandOption & { name: string }) {
  return class FileCommand extends Command {
    constructor() {
      super();
      this.id = commandOption.id;
      this.name = commandOption.name;
    }

    protected async doCommandRun(...args) {
      if ((this.id === COMMAND_UPLOAD_FILE_TO_ALL_PROFILES || this.id === COMMAND_UPLOAD_FOLDER_TO_ALL_PROFILES) 
        && await window.showInformationMessage('Are you sure you want to upload to all profiles?', 'Yes', 'No').then(answer => answer !== 'Yes')) {
        return;
      }
      
      const target = await commandOption.getFileTarget(...args);
      if (!target) {
        logger.warn(`The "${this.name}" command get canceled because of missing targets.`);
        return;
      }

      const targetList: Uri[] = Array.isArray(target) ? target : [target];
      const pendingTasks = targetList.map(async uri => {
        try {
          await commandOption.handleFile(handleCtxFromUri(uri));
        } catch (error) {
          reportError(error);
        }
      });

      await Promise.all(pendingTasks);
    }
  };
}

export function createFileMultiCommand(commandOption: FileCommandOption & { name: string }) {
  return class FileCommand extends Command {
    constructor() {
      super();
      this.id = commandOption.id;
      this.name = commandOption.name;
    }

    protected async doCommandRun(...args) {
      if ((this.id === COMMAND_UPLOAD_FILE_TO_ALL_PROFILES || this.id === COMMAND_UPLOAD_FOLDER_TO_ALL_PROFILES) 
        && await window.showInformationMessage('Are you sure you want to upload to all profiles?', 'Yes', 'No').then(answer => answer !== 'Yes')) {
        return;
      }
      
      const target = await commandOption.getFileTarget(...args);
      if (!target) {
        logger.warn(`The "${this.name}" command get canceled because of missing targets.`);
        return;
      }

      const targetList: Uri[] = Array.isArray(target) ? target : [target];
      const pendingTasks = targetList.map(async uri => {
        try {
          await Promise.all(allHandleCtxFromUri(uri).map(commandOption.handleFile));
        } catch (error) {
          reportError(error);
        }
      });

      await Promise.all(pendingTasks);
    }
  };
}
