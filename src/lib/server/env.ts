// The project was renamed from Cortana to Samantha. Deployments configured
// before the rename still carry CORTANA_* variables, so every setting is read
// under its new name first and its old one second: nothing breaks while the
// hosting environment catches up.
export function setting(name: string): string | undefined {
  return (
    process.env[`SAMANTHA_${name}`] ||
    process.env[`CORTANA_${name}`] ||
    undefined
  );
}
