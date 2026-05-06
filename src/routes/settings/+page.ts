import packageJson from '../../../package.json';

export async function load() {
  return {
    appVersion: packageJson.version,
  };
}
