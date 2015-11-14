import * as core from 'core-js';
import {Metadata,Decorators} from 'aurelia-metadata';
import {AggregateError} from 'aurelia-logging';

/**
* Used to allow functions/classes to indicate that they should be registered as transients with the container.
*/
export class TransientRegistration {
  /**
  * Creates an instance of TransientRegistration.
  * @param [key] The key to register as.
  */
  constructor(key: any) {
    this.key = key;
  }

  /**
  * Called by the container to register the annotated function/class as transient.
  * @param container The container to register with.
  * @param key The key to register as.
  * @param fn The function to register (target of the annotation).
  */
  register(container: Container, key: any, fn: Function): void {
    container.registerTransient(this.key || key, fn);
  }
}

/**
* Used to allow functions/classes to indicate that they should be registered as singletons with the container.
*/
export class SingletonRegistration {
  /**
  * Creates an instance of SingletonRegistration.
  * @param [key] The key to register as.
  */
  constructor(keyOrRegisterInChild: any, registerInChild?: boolean = false) {
    if (typeof keyOrRegisterInChild === 'boolean') {
      this.registerInChild = keyOrRegisterInChild;
    } else {
      this.key = keyOrRegisterInChild;
      this.registerInChild = registerInChild;
    }
  }

  /**
  * Called by the container to register the annotated function/class as a singleton.
  * @param container The container to register with.
  * @param key The key to register as.
  * @param fn The function to register (target of the annotation).
  */
  register(container: Container, key: any, fn: Function): void {
    let destination = this.registerInChild ? container : container.root;
    destination.registerSingleton(this.key || key, fn);
  }
}

/**
* An abstract resolver used to allow functions/classes to specify custom dependency resolution logic.
*/
export class Resolver {
  /**
  * Called by the container to allow custom resolution of dependencies for a function/class.
  * @param container The container to resolve from.
  * @return Returns the resolved object.
  */
  get(container: Container): any {
    throw new Error('A custom Resolver must implement get(container) and return the resolved instance(s).');
  }
}

/**
* Used to allow functions/classes to specify lazy resolution logic.
*/
export class Lazy extends Resolver {
  /**
  * Creates an instance of the Lazy class.
  * @param key The key to lazily resolve.
  */
  constructor(key: any) {
    super();
    this.key = key;
  }

  /**
  * Called by the container to lazily resolve the dependency into a lazy locator function.
  * @param container The container to resolve from.
  * @return Returns a function which can be invoked at a later time to obtain the actual dependency.
  */
  get(container: Container): any {
    return () => {
      return container.get(this.key);
    };
  }

  /**
  * Creates a Lazy Resolver for the supplied key.
  * @param key The key to lazily resolve.
  * @return Returns an insance of Lazy for the key.
  */
  static of(key: any): Lazy {
    return new Lazy(key);
  }
}

/**
* Used to allow functions/classes to specify resolution of all matches to a key.
*/
export class All extends Resolver {
  /**
  * Creates an instance of the All class.
  * @param key The key to lazily resolve all matches for.
  */
  constructor(key: any) {
    super();
    this.key = key;
  }

  /**
  * Called by the container to resolve all matching dependencies as an array of instances.
  * @param container The container to resolve from.
  * @return Returns an array of all matching instances.
  */
  get(container: Container): any[] {
    return container.getAll(this.key);
  }

  /**
  * Creates an All Resolver for the supplied key.
  * @param key The key to resolve all instances for.
  * @return Returns an insance of All for the key.
  */
  static of(key: any): All {
    return new All(key);
  }
}

/**
* Used to allow functions/classes to specify an optional dependency, which will be resolved only if already registred with the container.
*/
export class Optional extends Resolver {
  /**
  * Creates an instance of the Optional class.
  * @param key The key to optionally resolve for.
  * @param [checkParent=false] Indicates whether or not the parent container hierarchy should be checked.
  */
  constructor(key: any, checkParent?: boolean = false) {
    super();
    this.key = key;
    this.checkParent = checkParent;
  }

  /**
  * Called by the container to provide optional resolution of the key.
  * @param container The container to resolve from.
  * @return Returns the instance if found; otherwise null.
  */
  get(container: Container): any {
    if (container.hasHandler(this.key, this.checkParent)) {
      return container.get(this.key);
    }

    return null;
  }

  /**
  * Creates an Optional Resolver for the supplied key.
  * @param key The key to optionally resolve for.
  * @param [checkParent=false] Indicates whether or not the parent container hierarchy should be checked.
  * @return Returns an insance of Optional for the key.
  */
  static of(key: any, checkParent?: boolean = false): Optional {
    return new Optional(key, checkParent);
  }
}


/**
* Used to inject the dependency from the parent container instead of the current one.
*/
export class Parent extends Resolver {
  /**
  * Creates an instance of the Parent class.
  * @param key The key to resolve from the parent container.
  */
  constructor(key: any) {
    super();
    this.key = key;
  }

  /**
  * Called by the container to load the dependency from the parent container
  * @param container The container to resolve the parent from.
  * @return Returns the matching instance from the parent container
  */
  get(container: Container): any {
    return container.parent
      ? container.parent.get(this.key)
      : null;
  }

  /**
  * Creates a Parent Resolver for the supplied key.
  * @param key The key to resolve.
  * @return Returns an insance of Parent for the key.
  */
  static of(key : any) : Parent {
    return new Parent(key);
  }
}

/**
* Used to instantiate a class.
*/
export class ClassActivator {
  /**
  * The singleton instance of the ClassActivator.
  */
  static instance = new ClassActivator();

  /**
  * Invokes the classes constructor with the provided arguments.
  * @param fn The constructor function.
  * @param args The constructor args.
  * @return The newly created instance.
  */
  invoke(fn: Function, args: any[]): any {
    return Reflect.construct(fn, args);
  }
}

/**
* Used to invoke a factory method.
*/
export class FactoryActivator {
  /**
  * The singleton instance of the FactoryActivator.
  */
  static instance = new FactoryActivator();

  /**
  * Invokes the factory function with the provided arguments.
  * @param fn The factory function.
  * @param args The function args.
  * @return The newly created instance.
  */
  invoke(fn: Function, args: any[]): any {
    return fn.apply(undefined, args);
  }
}

const badKeyError = 'key/value cannot be null or undefined. Are you trying to inject/register something that doesn\'t exist with DI?';

Metadata.registration = 'aurelia:registration';
Metadata.instanceActivator = 'aurelia:instance-activator';

// Fix Function#name on browsers that do not support it (IE):
function test() {}
if (!test.name) {
  Object.defineProperty(Function.prototype, 'name', {
    get: function() {
      let name = this.toString().match(/^\s*function\s*(\S*)\s*\(/)[1];
      // For better performance only parse once, and then cache the
      // result through a new accessor for repeated access.
      Object.defineProperty(this, 'name', { value: name });
      return name;
    }
  });
}

export const emptyParameters = Object.freeze([]);

/**
* A lightweight, extensible dependency injection container.
*/
export class Container {
  static instance: Container;

  constructor(constructionInfo?: Map<Function, Object>) {
    this.constructionInfo = constructionInfo || new Map();
    this.entries = new Map();
    this.root = this;
  }

  /**
  * Makes this container instance globally reachable through Container.instance.
  */
  makeGlobal(): Container {
    Container.instance = this;
    return this;
  }

  /**
  * Registers an existing object instance with the container.
  * @param key The key that identifies the dependency at resolution time; usually a constructor function.
  * @param instance The instance that will be resolved when the key is matched.
  */
  registerInstance(key: any, instance: any): void {
    this.registerHandler(key, x => instance);
  }

  /**
  * Registers a type (constructor function) such that the container returns a new instance for each request.
  * @param key The key that identifies the dependency at resolution time; usually a constructor function.
  * @param [fn] The constructor function to use when the dependency needs to be instantiated.
  */
  registerTransient(key: any, fn?: Function): void {
    fn = fn || key;
    this.registerHandler(key, x => x.invoke(fn));
  }

  /**
  * Registers a type (constructor function) such that the container always returns the same instance for each request.
  * @param key The key that identifies the dependency at resolution time; usually a constructor function.
  * @param [fn] The constructor function to use when the dependency needs to be instantiated.
  */
  registerSingleton(key: any, fn?: Function): void {
    let singleton = null;
    fn = fn || key;
    this.registerHandler(key, x => singleton || (singleton = x.invoke(fn)));
  }

  /**
  * Registers a type (constructor function) by inspecting its registration annotations. If none are found, then the default singleton registration is used.
  * @param fn The constructor function to use when the dependency needs to be instantiated.
  * @param [key] The key that identifies the dependency at resolution time; usually a constructor function.
  */
  autoRegister(fn: any, key?: any): void {
    let registration;

    if (fn === null || fn === undefined) {
      throw new Error(badKeyError);
    }

    if (typeof fn === 'function') {
      registration = Metadata.get(Metadata.registration, fn);

      if (registration !== undefined) {
        registration.register(this, key || fn, fn);
      } else {
        this.registerSingleton(key || fn, fn);
      }
    } else {
      this.registerInstance(fn, fn);
    }
  }

  /**
  * Registers an array of types (constructor functions) by inspecting their registration annotations. If none are found, then the default singleton registration is used.
  * @param {Function[]} fns The constructor function to use when the dependency needs to be instantiated.
  */
  autoRegisterAll(fns: any[]): void {
    let i = fns.length;
    while (i--) {
      this.autoRegister(fns[i]);
    }
  }

  /**
  * Registers a custom resolution function such that the container calls this function for each request to obtain the instance.
  * @param key The key that identifies the dependency at resolution time; usually a constructor function.
  * @param handler The resolution function to use when the dependency is needed. It will be passed one arguement, the container instance that is invoking it.
  */
  registerHandler(key: any, handler: (c: Container) => any): void {
    this._getOrCreateEntry(key).push(handler);
  }

  /**
  * Unregisters based on key.
  * @param key The key that identifies the dependency at resolution time; usually a constructor function.
  */
  unregister(key: any) : void {
    this.entries.delete(key);
  }

  /**
  * Resolves a single instance based on the provided key.
  * @param key The key that identifies the object to resolve.
  * @return Returns the resolved instance.
  */
  get(key: any): any {
    let entry;

    if (key === null || key === undefined) {
      throw new Error(badKeyError);
    }

    if (key === Container) {
      return this;
    }

    if (key instanceof Resolver) {
      return key.get(this);
    }

    entry = this.entries.get(key);

    if (entry !== undefined) {
      return entry[0](this);
    }

    if (this.parent) {
      return this.parent.get(key);
    }

    this.autoRegister(key);
    entry = this.entries.get(key);

    return entry[0](this);
  }

  /**
  * Resolves all instance registered under the provided key.
  * @param key The key that identifies the objects to resolve.
  * @return Returns an array of the resolved instances.
  */
  getAll(key: any): any[] {
    let entry;

    if (key === null || key === undefined) {
      throw new Error(badKeyError);
    }

    entry = this.entries.get(key);

    if (entry !== undefined) {
      return entry.map(x => x(this));
    }

    if (this.parent) {
      return this.parent.getAll(key);
    }

    return [];
  }

  /**
  * Inspects the container to determine if a particular key has been registred.
  * @param key The key that identifies the dependency at resolution time; usually a constructor function.
  * @param [checkParent=false] Indicates whether or not to check the parent container hierarchy.
  * @return Returns true if the key has been registred; false otherwise.
  */
  hasHandler(key: any, checkParent?: boolean = false): boolean {
    if (key === null || key === undefined) {
      throw new Error(badKeyError);
    }

    return this.entries.has(key)
      || (checkParent && this.parent && this.parent.hasHandler(key, checkParent));
  }

  /**
  * Creates a new dependency injection container whose parent is the current container.
  * @return Returns a new container instance parented to this.
  */
  createChild(): Container {
    let childContainer = new Container(this.constructionInfo);
    childContainer.parent = this;
    childContainer.root = this.root;
    return childContainer;
  }

  /**
  * Invokes a function, recursively resolving its dependencies.
  * @param fn The function to invoke with the auto-resolved dependencies.
  * @param [deps] Additional function dependencies to use during invocation.
  * @return Returns the instance resulting from calling the function.
  */
  invoke(fn : Function, deps? : any[]) : any {
    let info;
    let i;
    let ii;
    let keys;
    let args;

    try {
      info = this._getOrCreateConstructionInfo(fn);
      keys = info.keys;
      args = new Array(keys.length);

      for (i = 0, ii = keys.length; i < ii; ++i) {
        args[i] = this.get(keys[i]);
      }

      if (deps !== undefined) {
        args = args.concat(deps);
      }

      return info.activator.invoke(fn, args);
    } catch(e) {
      let activatingText = info && info.activator instanceof ClassActivator ? 'instantiating' : 'invoking';
      let message = `Error ${activatingText} ${fn.name}.`;
      if (i < ii) {
        message += ` The argument at index ${i} (key:${keys[i]}) could not be satisfied.`;
      }

      message += ' Check the inner error for details.';

      throw new AggregateError(message, e, true);
    }
  }

  _getOrCreateEntry(key) {
    let entry;

    if (key === null || key === undefined) {
      throw new Error('key cannot be null or undefined.  (Are you trying to inject something that doesn\'t exist with DI?)');
    }

    entry = this.entries.get(key);

    if (entry === undefined) {
      entry = [];
      this.entries.set(key, entry);
    }

    return entry;
  }

  _getOrCreateConstructionInfo(fn) {
    let info = this.constructionInfo.get(fn);

    if (info === undefined) {
      info = this._createConstructionInfo(fn);
      this.constructionInfo.set(fn, info);
    }

    return info;
  }

  _createConstructionInfo(fn) {
    let info = {activator: Metadata.getOwn(Metadata.instanceActivator, fn) || ClassActivator.instance};

    if (fn.inject !== undefined) {
      if (typeof fn.inject === 'function') {
        info.keys = fn.inject();
      } else {
        info.keys = fn.inject;
      }

      return info;
    }

    info.keys = Metadata.getOwn(Metadata.paramTypes, fn) || emptyParameters;
    return info;
  }
}

export function autoinject(potentialTarget?: any) {
  let deco = function(target) {
    target.inject = Metadata.getOwn(Metadata.paramTypes, target) || emptyParameters;
  };

  return potentialTarget ? deco(potentialTarget) : deco;
}

export function inject(...rest: any[]) {
  return function(target) {
    target.inject = rest;
  };
}

export function registration(value: any) {
  return function(target) {
    Metadata.define(Metadata.registration, value, target);
  };
}

export function transient(key?: any) {
  return registration(new TransientRegistration(key));
}

export function singleton(keyOrRegisterInChild?: any, registerInChild?: boolean = false) {
  return registration(new SingletonRegistration(keyOrRegisterInChild, registerInChild));
}

export function instanceActivator(value: any) {
  return function(target) {
    Metadata.define(Metadata.instanceActivator, value, target);
  };
}

export function factory() {
  return instanceActivator(FactoryActivator.instance);
}

Decorators.configure.simpleDecorator('autoinject', autoinject);
Decorators.configure.parameterizedDecorator('inject', inject);
Decorators.configure.parameterizedDecorator('registration', registration);
Decorators.configure.parameterizedDecorator('transient', transient);
Decorators.configure.parameterizedDecorator('singleton', singleton);
Decorators.configure.parameterizedDecorator('instanceActivator', instanceActivator);
Decorators.configure.parameterizedDecorator('factory', factory);
