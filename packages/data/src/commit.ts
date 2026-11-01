/** Show `next` immediately. Put `previous` back if `write` fails. */
export async function commitOptimistic<T>(options: {
  previous: T;
  next: T;
  apply: (value: T) => void;
  write: () => Promise<void>;
}): Promise<'kept' | 'restored'> {
  options.apply(options.next);
  try {
    await options.write();
    return 'kept';
  } catch {
    options.apply(options.previous);
    return 'restored';
  }
}
