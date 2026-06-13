# Flujo de Despliegue de RODEO (GitOps)

Este documento detalla cómo está estructurado el flujo de trabajo para pasar cambios desde el entorno local de desarrollo hasta Producción, asegurando que ninguna funcionalidad nueva rompa la plataforma principal.

## 1. Ambientes Disponibles

Contamos con dos ambientes sincronizados automáticamente mediante GitHub Actions:

- **Staging (Pruebas)**
  - **URL:** [https://staging.rodeoagtech.com](https://staging.rodeoagtech.com)
  - **Rama de GitHub:** `staging`
  - **Propósito:** Entorno idéntico a producción donde tú y el equipo pueden probar nuevas funcionalidades, revisar el diseño y buscar errores sin afectar a los clientes reales.

- **Producción (En vivo)**
  - **URL:** [https://rodeoagtech.com](https://rodeoagtech.com)
  - **Rama de GitHub:** `main`
  - **Propósito:** La plataforma real que usan los clientes. Nunca se debe desarrollar directamente aquí.

---

## 2. Comandos de Despliegue (Atajos del IDE)

Para hacer el trabajo mucho más fácil, hemos configurado dos comandos (atajos) que puedes ejecutar directamente desde la terminal de tu IDE (asegúrate de estar en la carpeta raíz `RODEO`).

### Desplegar a Staging
Cuando estés trabajando en tu código y quieras subir los cambios para probarlos en internet, ejecuta:

```bash
npm run deploy:staging
```
**¿Qué hace este comando?**
1. Guarda todos los archivos modificados.
2. Crea un commit automático con el mensaje *"Despliegue a Staging"*.
3. Empuja los cambios a la rama `staging`.
4. GitHub Actions detecta la subida y actualiza silenciosamente `staging.rodeoagtech.com`.

### Promover a Producción
Una vez que hayas revisado el servidor de Staging y verifiques que todo funciona a la perfección, estás listo para lanzar la actualización a los clientes. Ejecuta:

```bash
npm run deploy:prod
```
**¿Qué hace este comando?**
1. Cambia tu entorno local a la rama `main` (Producción).
2. Absorbe (hace un *merge*) de todo el código que ya probaste en `staging`.
3. Empuja el código unificado a GitHub.
4. GitHub Actions detecta la subida y actualiza `rodeoagtech.com`.
5. Automáticamente te devuelve a la rama `staging` para que sigas trabajando seguro en el futuro.

---

## 3. Flujo Recomendado de Trabajo Diario

Para mantener la calidad y estabilidad de la plataforma, sigue siempre esta rutina:

1. Programa tus nuevas funcionalidades o resuelve *bugs* en tu computadora (estando en la rama `staging`).
2. Usa `npm run deploy:staging` para subir los cambios al servidor de pruebas.
3. Entra a `staging.rodeoagtech.com` desde tu navegador y juega con la plataforma para confirmar que la nueva funcionalidad cumple su objetivo.
4. Si encuentras un error, corrígelo en tu código y vuelve al Paso 2.
5. Si todo está impecable, usa `npm run deploy:prod` para que los clientes reciban la actualización de inmediato.
