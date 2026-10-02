interface ImmediateOutboxDeliveryDependencies<T> {
  persist(): Promise<T>;
  dispatch(): Promise<{ sent: number; failed: number }>;
  onDispatchError(error: unknown): void;
}

export async function persistAndDispatchOutbox<T>(
  dependencies: ImmediateOutboxDeliveryDependencies<T>,
): Promise<T> {
  const result = await dependencies.persist();
  try {
    await dependencies.dispatch();
  } catch (error) {
    dependencies.onDispatchError(error);
  }
  return result;
}
