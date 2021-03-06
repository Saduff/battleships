import 'core-js';

let originStorage = new Map();
let unknownOrigin = Object.freeze({moduleId: undefined, moduleMember: undefined});

/**
* A metadata annotation that describes the origin module of the function to which it's attached.
*/
export class Origin {
  /**
  * Creates an instance of Origin metadata.
  * @param moduleId The origin module id.
  * @param moduleMember The name of the export in the origin module.
  */
  constructor(moduleId: string, moduleMember: string) {
    this.moduleId = moduleId;
    this.moduleMember = moduleMember;
  }

  /**
  * Get the Origin annotation for the specified function.
  * @param fn The function to inspect for Origin metadata.
  * @return Returns the Origin metadata.
  */
  static get(fn: Function): Origin {
    let origin = originStorage.get(fn);

    if (origin === undefined) {
      System.forEachModule((key, value) => {
        for (let name in value) {
          let exp = value[name];
          if (exp === fn) {
            originStorage.set(fn, origin = new Origin(key, name));
            return true;
          }
        }

        if (value === fn) {
          originStorage.set(fn, origin = new Origin(key, 'default'));
          return true;
        }
      });
    }

    return origin || unknownOrigin;
  }

  /**
  * Set the Origin annotation for the specified function.
  * @param fn The function to set the Origin metadata on.
  * @param fn The Origin metadata to store on the function.
  * @return Returns the Origin metadata.
  */
  static set(fn: Function, origin: Origin): void {
    originStorage.set(fn, origin);
  }
}
