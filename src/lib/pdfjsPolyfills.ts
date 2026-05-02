if (typeof Promise.withResolvers === 'undefined') {
  (Promise as any).withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof Object.hasOwn === 'undefined') {
  Object.hasOwn = function (obj: any, prop: any) {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  };
}

export {};
