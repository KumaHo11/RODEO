# Fórmulas y Conceptos del Manejo Holístico de Pastoreo

Este documento contiene la síntesis de las fórmulas matemáticas, reglas y conceptos extraídos de la metodología de Allan Savory (Manejo Holístico), diseñados específicamente para ser modelados en el **Planificador de Pastoreo (Gantt y Cards)** de la plataforma RODEO.

---

## 1. Conceptos Fundamentales (Vocabulario de RODEO)

Para la base de datos y la interfaz de usuario, estandarizamos los siguientes términos:

1.  **UG (Unidad Ganadera)** o **EV (Equivalente Vaca)**: Representa el requerimiento nutricional estándar de una vaca de 400-450 kg con cría al pie. Toda otra categoría (terneros, ovejas, novillos pesados) se convierte a fracciones o múltiplos de UG.
    *   *Ejemplo*: 1 cordero = 0.2 UG. 1 Toro pesado = 1.5 UG.
2.  **Rodeo (Herd / Mob)**: Un grupo de animales que se maneja de forma conjunta en los potreros.
3.  **Días Animal (DA)**: La cantidad de forraje necesaria para alimentar a 1 UG durante 1 día.
    *   *Fórmula*: `DA = Número de Animales × Equivalencia UG × Días de Pastoreo`
4.  **Ración (Días Animal / Hectárea - DAH)**: Es la estimación de la cantidad de forraje (capacidad de soporte) que tiene un potrero determinado por cada hectárea para un único evento de pastoreo. Mide la **eficiencia del potrero**.
5.  **Período de Descanso (Rest Period - PD)**: Tiempo (en días) que un potrero debe permanecer libre de animales para que la planta forrajera recupere su vigor (crecimiento de raíz) antes de volver a ser pastoreada.
6.  **Período de Ocupación / Pastoreo (Grazing Period - PO)**: Tiempo (en días o fracciones de día) que un Rodeo permanece en un potrero específico.
7.  **Tasa de Crecimiento (Growth Rate)**: Determina la duración de recuperación necesaria de los pastos.
    *   **Crecimiento Rápido**: Ocurre en primavera/lluvias. Requiere Períodos de Descanso más cortos (ej. 30-45 días) y Períodos de Ocupación más cortos (para evitar que la planta se repastoree).
    *   **Crecimiento Lento**: Ocurre al avanzar el verano/sequía. Requiere Períodos de Descanso largos (ej. 60-90 días).
8.  **Temporada de Crecimiento (Abierta)** vs **Temporada de Letargo/Invierno (Cerrada)**: La planificación cambia diametralmente entre estas temporadas. En la Abierta se prioriza el "tiempo de descanso"; en la Cerrada se prioriza el "forraje acumulado (Ración)".

---

## 2. Fórmulas Matemáticas Clave para RODEO

El sistema deberá automatizar y sugerir cálculos mediante estas ecuaciones.

### A. Capacidad Total del Potrero (Volumen de Forraje)
Determina cuánto alimento hay disponible en todo el potrero para ese evento.
```mathematica
Total Días Animal (DA_Total) = DAH (Ración estimada) × Superficie del Potrero (Ha)
```

### B. Cálculo del Período de Ocupación (PO) sugerido por Potrero
Cuando un productor selecciona un Rodeo y lo asigna a un Potrero, el sistema debe calcular automáticamente cuántos días puede quedarse el Rodeo en ese potrero sin sobrepasarse del volumen de forraje.
```mathematica
Tamaño del Rodeo en UG (UG_Total) = Suma de (Cantidad de cabezas × Equivalencia UG por categoría)

Período de Ocupación en Días (PO) = DA_Total / UG_Total
```
> *Nota de UX para RODEO:* Si el resultado es `2.4 días`, el sistema debe permitir registrar medios turnos (ej. mover a la tarde).

### C. Relación entre Descanso, Ocupación y Número de Potreros (La Ecuación de Oro)
Para evitar el sobrepastoreo, el Período de Descanso (PD) debe estar matemáticamente alineado con los Períodos de Ocupación (PO) promedio y el Número de Potreros (N).
```mathematica
Período de Descanso (PD) = PO Promedio × (Número de Potreros - 1)
```
De esta fórmula se despejan dos escenarios prácticos de vital importancia para las alertas automáticas de RODEO:

#### Escenario C.1: Despejando Período de Ocupación Promedio
Si el productor sabe que por ser época de Crecimiento Lento necesita `60 días` de Descanso, y tiene `15 potreros` asignados a ese Rodeo, ¿cuánto es lo máximo que el rodeo puede estar en un potrero?
```mathematica
PO Máximo por Potrero = PD Deseado / (Número de Potreros - 1)
PO Máximo = 60 / (15 - 1) = 4.28 días
```
> *Alerta Automatizada:* Si el usuario manualmente extiende el Gantt de un potrero a 6 días en esta celularidad, el sistema debe emitir una alerta: "⚠️ Se superó el máximo de Ocupación Permitido (4.3d) para mantener sus 60 días de descanso."

#### Escenario C.2: Despejando Días de Descanso generados
El sistema usa el tiempo que un rodeo tarda en completar TODO el circuito para saber si ha pasado suficiente descanso cuando vuelva al potrero N° 1.
```mathematica
Días de Descanso generados para Potrero X = Sumatoria de los Días de Ocupación (PO) en todos los demás potreros del circuito.
```

### D. Tasa de Crecimiento y Puntos de Control (Checkpoints)
El sistema debe dividir el plan en fracciones (tercios o cuartos) para evaluar la Tasa de Crecimiento real contra la planeada:
*   Si el pasto crece **Poco o Más Lento**, la orden es: **Disminuir la velocidad del rodeo** (Aumentar PO) para dar _mayor_ tiempo de Descanso a los que están por venir. (O bien dar suplementos / vender).
*   Si el pasto crece **Más Rápido**, la orden es: **Aumentar la velocidad del rodeo** (Reducir PO) o apartar potreros para hacer reservas forrajeras (Heno/Rollo), porque si no el pasto se pasa y se endurece.

---

## 3. Lógica para el Módulo Planificador (Gantt y Cards)

### Estructura de Datos (BD PostGIS/Supabase)

Para soportar las fórmulas, el módulo de Planificación requiere estas tablas o relaciones:

1.  **Plan (Grazing_Plan)**
    *   `id_plan`: UUID
    *   `season_type`: Enum ('OPEN_GROWTH', 'CLOSED_NON_GROWTH')
    *   `start_date` / `end_date`
    *   `planned_rest_period`: Int (Días meta de descanso)
2.  **Rodeo_Célula (Herd)**
    *   `total_au` (Total UG dinámico derivado de los lotes asignados).
3.  **Mapeo Potrero_Plan (Plan_Paddocks)**
    *   `id_potrero`: UUID
    *   `estimated_adh` (Ración DAH estimada por el productor para ese plan).
    *   `total_ad`: Herd Size * ADH (Días Animal Totales calculados estáticamente).
4.  **Eventos del Gantt/Carta (Grazing_Event)**
    *   `id_event`: UUID
    *   `id_plan`, `id_rodeo`, `id_potrero`
    *   `date_in` (Ingreso)
    *   `date_out` (Salida)
    *   `actual_adh_consumed` (Se calcula post-mortem basándose en cuántos días realmente se quedaron).

### UX de Visualización DUAL

*   **View Cards (Para Estimar Volumen / DAH):** El productor ve tarjetas de potreros. Ingresa el DAH (Ej: 45 Raciones) en su teléfono o clickeando la card, y automáticamente la Card le devuelve el cálculo: `DAH (45) * Hectáreas (10) = 450 Días Animal. Entre tu rodeo (100 UG) = Tienes 4.5 días de pasto aquí.`
*   **View Gantt (El Reloj de Savory Digitalizado):** El productor arrastra barras en un calendario. La longitud de la barra determina el `date_in` y `date_out`. 
    *   *El Motor Matemático de RODEO por detrás debe hacer esto:* Toma la barra (ej: 4 días). Multiplica `4 días * 100 UG = 400 DA`. Divide por las `10 hectáreas`. Escribe sigilosamente un `DAH Consumido = 40`. Si este DAH es mucho mayor al DAH de años anteriores en ese potrero, lanza advertencia de "Posible Sobrepastoreo (Pasto Raso)".

---

## 4. Diferencia: Planificación de Temporada Cerrada (Cálculo Inverso)

En invierno/letargo, el pasto NO crece. Es un almacén fijo. La fórmula de RODEO cambia al **Cálculo de Reserva**:
1. El usuario tiene `X Días de Temporada Cerrada` (ej. 100 días de invierno).
2. Se suman todos los `Total Días Animal (DA_Total)` sumando el volumen estimado de todos los potreros diferidos/reservados. (Ej. Todos los potreros juntos tienen 12,000 DA de reserva en pie/rollo).
3. Carga Animal del Rodeo: 100 UG.
4. Soporte Total = `12,000 DA / 100 UG = 120 Días de soportabilidad`.
5. *Validación RODEO:* 120 días de soporte > 100 días de invierno. ¡Plan factible! Si fuera menor, RODEO lanza alerta ROJA en la interfaz exigiendo compra de rollos, venta de cabezas, o ajuste agresivo de las dietas.

---
## Próximos Pasos (Validación):
Con esto ya contamos con la maquinaria de "backend" biológico lista. Nuestra propuesta será llevar estas ecuaciones a Funciones RPC en Supabase, y usarlas en Zustand para nutrir las Cards de Potreros y las barras del Gantt de forma reactiva.
