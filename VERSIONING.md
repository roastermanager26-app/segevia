# Versionado de SEGEVIA

La versión visible de la aplicación se define exclusivamente en `apps/web/src/lib/appInfo.ts`.

Formato: `vM.MMAA.P`

- `M`: versión mayor; incrementarla solo ante cambios radicales o incompatibles de la aplicación.
- `MMAA`: mes y año de la última versión. Por ejemplo, `1026` representa octubre de 2026.
- `P`: incremento menor dentro del mismo mes/año y versión mayor.

Ejemplo: `v1.1026.1` → `v1.1026.2` para un cambio menor durante octubre de 2026. En noviembre de 2026: `v1.1126.1`.

Antes de cada commit que vaya a GitHub o Vercel, actualizar `APP_VERSION` siguiendo esta regla. La versión se muestra debajo del logo en la barra lateral.
