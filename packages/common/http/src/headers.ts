/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

interface Update {
  name: string;
  value?: string|string[];
  op: 'a'|'s'|'d';
}

/**
 * Immutable set of Http headers, with lazy parsing.
 *
 * Http 头的不可变集合，惰性解析。
 *
 */
export class HttpHeaders {
  /**
   * Internal map of lowercase header names to values.
   *
   * 一个内部映射表，key 是头名称的小写形式，value 是其值。
   */
  // TODO(issue/24571): remove '!'.
  private headers !: Map<string, string[]>;


  /**
   * Internal map of lowercased header names to the normalized
   * form of the name (the form seen first).
   *
   * 一个内部映射表，key 是头名称的小写形式，值是该名称的标准化形式（即首先看到的形式）。
   */
  private normalizedNames: Map<string, string> = new Map();

  /**
   * Complete the lazy initialization of this object (needed before reading).
   *
   * 完成该对象的惰性初始化（在读取之前需要）。
   */
  // TODO(issue/24571): remove '!'.
  private lazyInit !: HttpHeaders | Function | null;

  /**
   * Queued updates to be materialized the next initialization.
   *
   * 一个队列，用于存储下次初始化时要执行的更新。
   */
  private lazyUpdate: Update[]|null = null;

  constructor(headers?: string|{[name: string]: string | string[]}) {
    if (!headers) {
      this.headers = new Map<string, string[]>();
    } else if (typeof headers === 'string') {
      this.lazyInit = () => {
        this.headers = new Map<string, string[]>();
        headers.split('\n').forEach(line => {
          const index = line.indexOf(':');
          if (index > 0) {
            const name = line.slice(0, index);
            const key = name.toLowerCase();
            const value = line.slice(index + 1).trim();
            this.maybeSetNormalizedName(name, key);
            if (this.headers.has(key)) {
              this.headers.get(key) !.push(value);
            } else {
              this.headers.set(key, [value]);
            }
          }
        });
      };
    } else {
      this.lazyInit = () => {
        this.headers = new Map<string, string[]>();
        Object.keys(headers).forEach(name => {
          let values: string|string[] = headers[name];
          const key = name.toLowerCase();
          if (typeof values === 'string') {
            values = [values];
          }
          if (values.length > 0) {
            this.headers.set(key, values);
            this.maybeSetNormalizedName(name, key);
          }
        });
      };
    }
  }

  /**
   * Checks for existence of header by given name.
   *
   * 检查是否存在指定名称的头。
   */
  has(name: string): boolean {
    this.init();

    return this.headers.has(name.toLowerCase());
  }

  /**
   * Returns first header that matches given name.
   *
   * 返回匹配指定名称的第一个头的值。
   */
  get(name: string): string|null {
    this.init();

    const values = this.headers.get(name.toLowerCase());
    return values && values.length > 0 ? values[0] : null;
  }

  /**
   * Returns the names of the headers
   *
   * 返回头中所有的名称。
   */
  keys(): string[] {
    this.init();

    return Array.from(this.normalizedNames.values());
  }

  /**
   * Returns list of header values for a given name.
   *
   * 返回头中具有指定名称的值的列表。
   */
  getAll(name: string): string[]|null {
    this.init();

    return this.headers.get(name.toLowerCase()) || null;
  }

  append(name: string, value: string|string[]): HttpHeaders {
    return this.clone({name, value, op: 'a'});
  }

  set(name: string, value: string|string[]): HttpHeaders {
    return this.clone({name, value, op: 's'});
  }

  delete (name: string, value?: string|string[]): HttpHeaders {
    return this.clone({name, value, op: 'd'});
  }

  private maybeSetNormalizedName(name: string, lcName: string): void {
    if (!this.normalizedNames.has(lcName)) {
      this.normalizedNames.set(lcName, name);
    }
  }

  private init(): void {
    if (!!this.lazyInit) {
      if (this.lazyInit instanceof HttpHeaders) {
        this.copyFrom(this.lazyInit);
      } else {
        this.lazyInit();
      }
      this.lazyInit = null;
      if (!!this.lazyUpdate) {
        this.lazyUpdate.forEach(update => this.applyUpdate(update));
        this.lazyUpdate = null;
      }
    }
  }

  private copyFrom(other: HttpHeaders) {
    other.init();
    Array.from(other.headers.keys()).forEach(key => {
      this.headers.set(key, other.headers.get(key) !);
      this.normalizedNames.set(key, other.normalizedNames.get(key) !);
    });
  }

  private clone(update: Update): HttpHeaders {
    const clone = new HttpHeaders();
    clone.lazyInit =
        (!!this.lazyInit && this.lazyInit instanceof HttpHeaders) ? this.lazyInit : this;
    clone.lazyUpdate = (this.lazyUpdate || []).concat([update]);
    return clone;
  }

  private applyUpdate(update: Update): void {
    const key = update.name.toLowerCase();
    switch (update.op) {
      case 'a':
      case 's':
        let value = update.value !;
        if (typeof value === 'string') {
          value = [value];
        }
        if (value.length === 0) {
          return;
        }
        this.maybeSetNormalizedName(update.name, key);
        const base = (update.op === 'a' ? this.headers.get(key) : undefined) || [];
        base.push(...value);
        this.headers.set(key, base);
        break;
      case 'd':
        const toDelete = update.value as string | undefined;
        if (!toDelete) {
          this.headers.delete(key);
          this.normalizedNames.delete(key);
        } else {
          let existing = this.headers.get(key);
          if (!existing) {
            return;
          }
          existing = existing.filter(value => toDelete.indexOf(value) === -1);
          if (existing.length === 0) {
            this.headers.delete(key);
            this.normalizedNames.delete(key);
          } else {
            this.headers.set(key, existing);
          }
        }
        break;
    }
  }

  /**
   * @internal
   */
  forEach(fn: (name: string, values: string[]) => void) {
    this.init();
    Array.from(this.normalizedNames.keys())
        .forEach(key => fn(this.normalizedNames.get(key) !, this.headers.get(key) !));
  }
}
