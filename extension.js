const vscode = require('vscode');
const path = require('path');
const fs = require('fs');

let statusBarItem;
let startTime;
let timerInterval;
let isActive = true;
let sessionData = {};
let panel = undefined;

// Ruta para guardar los datos
let dataFilePath;

/**
 * Cuando se activa la extensión
 * @param {vscode.ExtensionContext} context 
 */
function activate(context) {
  console.log('La extensión "Mi Tiempo de Pantalla" está activa');

  // Establecer la ruta del archivo de datos
  dataFilePath = path.join(context.globalStoragePath, 'screen-time-data.json');
  
  // Asegurar que el directorio existe
  const dir = path.dirname(dataFilePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Cargar datos previos si existen
  loadData();

  // Crear el elemento de la barra de estado
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'mi-tiempo-pantalla.showStats';
  context.subscriptions.push(statusBarItem);

  // Registrar el comando para mostrar estadísticas
  let showStatsCommand = vscode.commands.registerCommand('mi-tiempo-pantalla.showStats', () => {
    showStatisticsPanel(context.extensionUri);
  });
  context.subscriptions.push(showStatsCommand);

  // Iniciar el contador
  startTime = new Date();
  
  // Actualizar el contador cada segundo
  timerInterval = setInterval(() => {
    updateStatusBar();
    updateSessionData();
  }, 1000);
  
  // Mostrar el elemento en la barra de estado
  statusBarItem.show();

  // Detectar cuando el editor está activo o inactivo
  vscode.window.onDidChangeWindowState(windowState => {
    isActive = windowState.focused;
  });
  
  // Guardar datos cuando VS Code se cierra
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(() => {
    saveData();
  }));
}

/**
 * Actualiza el texto en la barra de estado (siempre formato corto)
 */
function updateStatusBar() {
  if (!isActive) return;
  
  const now = new Date();
  const elapsedMs = now - startTime;
  
  // Calcular horas, minutos y segundos
  const seconds = Math.floor((elapsedMs / 1000) % 60);
  const minutes = Math.floor((elapsedMs / (1000 * 60)) % 60);
  const hours = Math.floor(elapsedMs / (1000 * 60 * 60));
  
  // Siempre usar formato corto
  const timeText = `⏱️ ${hours}h ${minutes}m ${seconds}s`;
  
  statusBarItem.text = timeText;
}

/**
 * Actualiza los datos de la sesión actual
 */
function updateSessionData() {
  if (!isActive) return;
  
  const now = new Date();
  const today = formatDate(now);
  const hour = now.getHours();
  
  // Inicializar datos para el día actual si no existen
  if (!sessionData[today]) {
    sessionData[today] = {
      totalSeconds: 0,
      hourlyData: Array(24).fill(0)
    };
  }
  
  // Incrementar contador para el día y hora actual
  sessionData[today].totalSeconds++;
  sessionData[today].hourlyData[hour]++;
  
  // Guardar datos cada minuto
  if (sessionData[today].totalSeconds % 60 === 0) {
    saveData();
  }
}

/**
 * Guardar datos en archivo
 */
function saveData() {
  try {
    const dataString = JSON.stringify(sessionData);
    fs.writeFileSync(dataFilePath, dataString);
  } catch (error) {
    console.error('Error guardando datos:', error);
  }
}

/**
 * Cargar datos previos
 */
function loadData() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const dataString = fs.readFileSync(dataFilePath, 'utf8');
      sessionData = JSON.parse(dataString);
    } else {
      sessionData = {};
    }
  } catch (error) {
    console.error('Error cargando datos previos:', error);
    sessionData = {};
  }
}

/**
 * Formatea la fecha como YYYY-MM-DD
 * @param {Date} date 
 * @returns {string}
 */
function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Obtiene los datos de la semana actual
 * @returns {Object}
 */
function getCurrentWeekData() {
  const result = {
    days: [],
    values: []
  };
  
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ...
  
  // Ajustar para que la semana comience el lunes
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Obtener fecha del lunes de esta semana
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  
  // Generar datos para cada día de lunes a domingo
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dateStr = formatDate(day);
    
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    result.days.push(dayNames[i]);
    
    // Obtener total de segundos para ese día, o 0 si no hay datos
    const seconds = sessionData[dateStr] ? sessionData[dateStr].totalSeconds : 0;
    const minutes = Math.round(seconds / 60);
    result.values.push(minutes);
  }
  
  return result;
}

/**
 * Obtiene los datos por hora para un día específico
 * @param {string} dateStr - Fecha en formato YYYY-MM-DD
 * @returns {Object}
 */
function getHourlyData(dateStr) {
  const result = {
    hours: Array.from({ length: 24 }, (_, i) => `${i}h`),
    values: Array(24).fill(0)
  };
  
  if (sessionData[dateStr] && sessionData[dateStr].hourlyData) {
    // Convertir segundos a minutos para la visualización
    result.values = sessionData[dateStr].hourlyData.map(seconds => Math.round(seconds / 60));
  }
  
  return result;
}

/**
 * Muestra el panel de estadísticas
 * @param {vscode.Uri} extensionUri 
 */
function showStatisticsPanel(extensionUri) {
  if (panel) {
    panel.reveal();
    return;
  }
  
  // Crear un nuevo panel
  panel = vscode.window.createWebviewPanel(
    'tiempoPantallaStats',
    'Análisis de Tiempo de Pantalla',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      retainContextWhenHidden: true
    }
  );
  
  // Manejar cuando el panel se cierra
  panel.onDidDispose(() => {
    panel = undefined;
  });
  
  // Manejar mensajes del webview
  panel.webview.onDidReceiveMessage(message => {
    if (message.command === 'getDayData') {
      const dayData = getHourlyData(message.date);
      panel.webview.postMessage({ command: 'dayData', data: dayData });
    }
  });
  
  // Establecer el HTML del panel
  updatePanelContent();
}

/**
 * Actualiza el contenido del panel
 */
function updatePanelContent() {
  if (!panel) return;
  
  const weekData = getCurrentWeekData();
  
  // Fecha actual para cargar datos por defecto
  const today = formatDate(new Date());
  const hourlyData = getHourlyData(today);
  
  panel.webview.html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Análisis de Tiempo de Pantalla</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
            }
            h1, h2 {
                color: var(--vscode-editor-foreground);
            }
            .chart-container {
                margin: 20px 0;
                height: 300px;
            }
            .buttons {
                display: flex;
                gap: 10px;
                margin: 20px 0;
            }
            button {
                padding: 8px 16px;
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js"></script>
    </head>
    <body>
        <h1>Análisis de Tiempo de Pantalla</h1>
        
        <h2>Productividad por día de la semana</h2>
        <div class="chart-container">
            <canvas id="weekChart"></canvas>
        </div>
        
        <h2>Productividad por hora del día</h2>
        <div class="buttons" id="dayButtons">
            <button data-date="${weekData.days[0]}" class="active">Lunes</button>
            <button data-date="${weekData.days[1]}">Martes</button>
            <button data-date="${weekData.days[2]}">Miércoles</button>
            <button data-date="${weekData.days[3]}">Jueves</button>
            <button data-date="${weekData.days[4]}">Viernes</button>
        </div>
        <div class="chart-container">
            <canvas id="hourlyChart"></canvas>
        </div>
        
        <script>
            // Datos iniciales
            const weekData = ${JSON.stringify(weekData)};
            const hourlyData = ${JSON.stringify(hourlyData)};
            let selectedDate = "${today}";
            
            // Configuración común para gráficos
            const chartConfig = {
                type: 'bar',
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Minutos de productividad'
                            }
                        }
                    }
                }
            };
            
            // Crear gráfico semanal
            const weekChart = new Chart(
                document.getElementById('weekChart'),
                {
                    ...chartConfig,
                    data: {
                        labels: weekData.days,
                        datasets: [{
                            label: 'Minutos',
                            data: weekData.values,
                            backgroundColor: 'rgba(54, 162, 235, 0.7)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }]
                    }
                }
            );
            
            // Crear gráfico por hora
            const hourlyChart = new Chart(
                document.getElementById('hourlyChart'),
                {
                    ...chartConfig,
                    data: {
                        labels: hourlyData.hours,
                        datasets: [{
                            label: 'Minutos',
                            data: hourlyData.values,
                            backgroundColor: 'rgba(75, 192, 192, 0.7)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1
                        }]
                    }
                }
            );
            
            // Comunicación con la extensión
            const vscode = acquireVsCodeApi();
            
            // Manejar clics en botones de día
            document.querySelectorAll('#dayButtons button').forEach(button => {
                button.addEventListener('click', () => {
                    // Actualizar botón activo
                    document.querySelectorAll('#dayButtons button').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    button.classList.add('active');
                    
                    // Obtener fecha seleccionada
                    const dayIndex = Array.from(button.parentNode.children).indexOf(button);
                    const today = new Date();
                    const dayOfWeek = today.getDay(); // 0 = Domingo, 1 = Lunes, ...
                    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    const monday = new Date(today);
                    monday.setDate(today.getDate() - daysToMonday);
                    const selectedDay = new Date(monday);
                    selectedDay.setDate(monday.getDate() + dayIndex);
                    
                    // Formatear fecha
                    selectedDate = \`\${selectedDay.getFullYear()}-\${String(selectedDay.getMonth() + 1).padStart(2, '0')}-\${String(selectedDay.getDate()).padStart(2, '0')}\`;
                    
                    // Solicitar datos para ese día
                    vscode.postMessage({
                        command: 'getDayData',
                        date: selectedDate
                    });
                });
            });
            
            // Escuchar mensajes de la extensión
            window.addEventListener('message', event => {
                const message = event.data;
                
                switch (message.command) {
                    case 'dayData':
                        // Actualizar gráfico por hora con los nuevos datos
                        hourlyChart.data.labels = message.data.hours;
                        hourlyChart.data.datasets[0].data = message.data.values;
                        hourlyChart.update();
                        break;
                }
            });
        </script>
    </body>
    </html>
  `;
}

/**
 * Cuando se desactiva la extensión
 */
function deactivate() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  
  // Guardar datos antes de desactivar
  saveData();
}

module.exports = {
  activate,
  deactivate
};