/*eslint dot-notation:0*/
import {
  Parser,
  ObserverLocator,
  EventManager,
  ListenerExpression,
  BindingExpression,
  CallExpression,
  bindingMode
} from 'aurelia-binding';

import {BehaviorInstruction} from 'aurelia-templating';

export class SyntaxInterpreter {
  static inject() { return [Parser, ObserverLocator, EventManager]; }
  constructor(parser, observerLocator, eventManager) {
    this.parser = parser;
    this.observerLocator = observerLocator;
    this.eventManager = eventManager;
  }

  interpret(resources, element, info, existingInstruction) {
    if (info.command in this) {
      return this[info.command](resources, element, info, existingInstruction);
    }

    return this.handleUnknownCommand(resources, element, info, existingInstruction);
  }

  handleUnknownCommand(resources, element, info, existingInstruction) {
    let attrName = info.attrName;
    let command = info.command;
    let instruction = this.options(resources, element, info, existingInstruction);

    instruction.alteredAttr = true;
    instruction.attrName = 'global-behavior';
    instruction.attributes.aureliaAttrName = attrName;
    instruction.attributes.aureliaCommand = command;

    return instruction;
  }

  determineDefaultBindingMode(element, attrName) {
    let tagName = element.tagName.toLowerCase();

    if (tagName === 'input') {
      return attrName === 'value' || attrName === 'checked' || attrName === 'files' ? bindingMode.twoWay : bindingMode.oneWay;
    } else if (tagName === 'textarea' || tagName === 'select') {
      return attrName === 'value' ? bindingMode.twoWay : bindingMode.oneWay;
    } else if (attrName === 'textcontent' || attrName === 'innerhtml') {
      return element.contentEditable === 'true' ? bindingMode.twoWay : bindingMode.oneWay;
    } else if (attrName === 'scrolltop' || attrName === 'scrollleft') {
      return bindingMode.twoWay;
    }

    return bindingMode.oneWay;
  }

  bind(resources, element, info, existingInstruction) {
    let instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);

    instruction.attributes[info.attrName] = new BindingExpression(
      this.observerLocator,
      this.attributeMap[info.attrName] || info.attrName,
      this.parser.parse(info.attrValue),
      info.defaultBindingMode || this.determineDefaultBindingMode(element, info.attrName),
      resources.valueConverterLookupFunction
    );

    return instruction;
  }

  trigger(resources, element, info) {
    return new ListenerExpression(
      this.eventManager,
      info.attrName,
      this.parser.parse(info.attrValue),
      false,
      true
    );
  }

  delegate(resources, element, info) {
    return new ListenerExpression(
      this.eventManager,
      info.attrName,
      this.parser.parse(info.attrValue),
      true,
      true
    );
  }

  call(resources, element, info, existingInstruction) {
    let instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);

    instruction.attributes[info.attrName] = new CallExpression(
      this.observerLocator,
      info.attrName,
      this.parser.parse(info.attrValue),
      resources.valueConverterLookupFunction
    );

    return instruction;
  }

  options(resources, element, info, existingInstruction) {
    let instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);
    let attrValue = info.attrValue;
    let language = this.language;
    let name = null;
    let target = '';
    let current;
    let i;
    let ii;

    for (i = 0, ii = attrValue.length; i < ii; ++i) {
      current = attrValue[i];

      if (current === ';') {
        info = language.inspectAttribute(resources, name, target.trim());
        language.createAttributeInstruction(resources, element, info, instruction);

        if (!instruction.attributes[info.attrName]) {
          instruction.attributes[info.attrName] = info.attrValue;
        }

        target = '';
        name = null;
      } else if (current === ':' && name === null) {
        name = target.trim();
        target = '';
      } else {
        target += current;
      }
    }

    if (name !== null) {
      info = language.inspectAttribute(resources, name, target.trim());
      language.createAttributeInstruction(resources, element, info, instruction);

      if (!instruction.attributes[info.attrName]) {
        instruction.attributes[info.attrName] = info.attrValue;
      }
    }

    return instruction;
  }
}

SyntaxInterpreter.prototype['for'] = function(resources, element, info, existingInstruction) {
  let parts;
  let keyValue;
  let instruction;
  let attrValue;
  let isDestructuring;

  attrValue = info.attrValue;
  isDestructuring = attrValue.match(/[[].+[\]]/);
  parts = isDestructuring ? attrValue.split('of ') : attrValue.split(' of ');

  if (parts.length !== 2) {
    throw new Error('Incorrect syntax for "for". The form is: "$local of $items" or "[$key, $value] of $items".');
  }

  instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);

  if (isDestructuring) {
    keyValue = parts[0].replace(/[[\]]/g, '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
    instruction.attributes.key = keyValue[0];
    instruction.attributes.value = keyValue[1];
  } else {
    instruction.attributes.local = parts[0];
  }

  instruction.attributes.items = new BindingExpression(
    this.observerLocator,
    'items',
    this.parser.parse(parts[1]),
    bindingMode.oneWay,
    resources.valueConverterLookupFunction
  );

  return instruction;
};

SyntaxInterpreter.prototype['two-way'] = function(resources, element, info, existingInstruction) {
  let instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);

  instruction.attributes[info.attrName] = new BindingExpression(
      this.observerLocator,
      this.attributeMap[info.attrName] || info.attrName,
      this.parser.parse(info.attrValue),
      bindingMode.twoWay,
      resources.valueConverterLookupFunction
    );

  return instruction;
};

SyntaxInterpreter.prototype['one-way'] = function(resources, element, info, existingInstruction) {
  let instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);

  instruction.attributes[info.attrName] = new BindingExpression(
    this.observerLocator,
    this.attributeMap[info.attrName] || info.attrName,
    this.parser.parse(info.attrValue),
    bindingMode.oneWay,
    resources.valueConverterLookupFunction
  );

  return instruction;
};

SyntaxInterpreter.prototype['one-time'] = function(resources, element, info, existingInstruction) {
  let instruction = existingInstruction || BehaviorInstruction.attribute(info.attrName);

  instruction.attributes[info.attrName] = new BindingExpression(
    this.observerLocator,
    this.attributeMap[info.attrName] || info.attrName,
    this.parser.parse(info.attrValue),
    bindingMode.oneTime,
    resources.valueConverterLookupFunction
  );

  return instruction;
};
