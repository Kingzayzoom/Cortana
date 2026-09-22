// The project was renamed from Cortana to Samantha. Environments configured
// before the rename still carry CORTANA_* variables, so scripts read each
// setting under its new name first and its old one second, like the app does.
export function setting(name) {
  return (
    process.env[`SAMANTHA_${name}`] ||
    process.env[`CORTANA_${name}`] ||
    undefined
  );
}
