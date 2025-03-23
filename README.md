# Mi Tiempo de Pantalla

Una extensión para VS Code que rastrea y visualiza tu tiempo de uso del editor con gráficos detallados.

## Características

- Muestra el tiempo de pantalla en la barra de estado en formato corto
- Análisis visual detallado de la productividad:
  - Gráfico semanal de productividad (lunes a domingo)
  - Gráfico de productividad por hora para cada día de la semana
- Selección de días de la semana (lunes a viernes) para analizar patrones diarios
- Almacenamiento persistente de datos para ver tendencias

## Uso

Una vez instalada, verás un contador en la barra de estado inferior derecha que muestra tu tiempo de pantalla activo.

Para ver las estadísticas detalladas:
1. Haz clic en el contador para abrir el panel de análisis
2. Se abrirá un panel con dos gráficos:
   - Productividad por día de la semana
   - Productividad por hora (para el día seleccionado)

## Instalación manual

1. Clona este repositorio
2. Abre la carpeta en VS Code
3. Presiona F5 para iniciar una nueva ventana con la extensión cargada
4. Verás el contador de tiempo en la barra de estado

## Empaquetado e instalación

Para crear un archivo VSIX para distribución:

1. Instala vsce: `npm install -g vsce`
2. Ejecuta: `vsce package`
3. Instala el archivo VSIX resultante en VS Code