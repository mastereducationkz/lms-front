/**
 * Catalog shapes. A message is a string with `{name}` placeholders, or a plural: one form per
 * Intl.PluralRules category, chosen by the `count` param. English needs one/other; Russian also
 * needs few/many (1 урок, 2 урока, 5 уроков).
 */

export interface PluralForms {
  readonly zero?: string;
  readonly one: string;
  readonly two?: string;
  readonly few?: string;
  readonly many?: string;
  readonly other: string;
}

export interface RuPluralForms {
  readonly one: string;
  readonly few: string;
  readonly many: string;
  readonly other: string;
}

export type Message = string | PluralForms;

export type MessageTable = Readonly<Record<string, Message>>;

/** The Russian half of a namespace: every English key, a plural stays a plural. */
export type RuTable<T extends MessageTable> = {
  readonly [K in keyof T]: T[K] extends string ? string : RuPluralForms;
};

export type Params = Readonly<Record<string, string | number>>;
