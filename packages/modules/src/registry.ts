export interface SharedDependency {
  name: string;
  range: string;
}

export interface ModuleContract {
  id: string;
  version: string;
  owner: string;
  title: string;
  route: string;
  budgets: {
    maxGzipBytes: number;
    maxInpMs: number;
  };
  shared: SharedDependency[];
}

export interface RegisteredModule<T> extends ModuleContract {
  load: () => Promise<T>;
}

const MODULE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createRegistry<T>() {
  const modules = new Map<string, RegisteredModule<T>>();

  return {
    register(module: RegisteredModule<T>) {
      if (!MODULE_ID.test(module.id)) {
        throw new Error(`Module id "${module.id}" must be kebab-case`);
      }
      if (modules.has(module.id)) {
        throw new Error(`Module "${module.id}" is already registered`);
      }
      modules.set(module.id, module);
    },
    get(id: string) {
      return modules.get(id);
    },
    list() {
      return [...modules.values()];
    },
  };
}

export type ModuleRegistry<T> = ReturnType<typeof createRegistry<T>>;
