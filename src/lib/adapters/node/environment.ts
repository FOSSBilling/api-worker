import { IEnvironment } from "../../interfaces";

export class NodeEnvironmentAdapter implements IEnvironment {
  get(key: string): string | undefined {
    return process.env[key];
  }

  has(key: string): boolean {
    return key in process.env;
  }
}
