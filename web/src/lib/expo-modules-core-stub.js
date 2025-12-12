// Заглушка для expo-modules-core
export const EventEmitter = class {
  addListener() { return { remove: () => {} }; }
  removeListener() {}
  emit() {}
};

export class CodedError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

export class UnavailabilityError extends Error {
  constructor(moduleName, propertyName) {
    super(`The method or property ${propertyName} is not available on ${moduleName}`);
  }
}

export const createPermissionHook = () => {
  return [null, () => {}, () => {}];
};

export default {};

