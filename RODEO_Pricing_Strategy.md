# RODEO - Estrategia de Precios y Monetización (SaaS AgTech)

## 1. Benchmark de Competidores Globales

| Plataforma | Origen | Foco Principal | Modelo de Monetización (Pricing Model) |
| :--- | :--- | :--- | :--- |
| **MaiaGrazing** | Australia | Pastoreo planificado, Forecasting forrajero, Savory. | **Por Unidad Animal (LSU/DSE) + Tiers.** Tienen planes Lite, Pro y Enterprise. El precio escala según el tamaño del rebaño, alineando el costo con la capacidad productiva del campo. |
| **AgriWebb** | Australia | Gestión integral (ovejas/vacas), auditorías, mapas. | **Suscripción Anual Basada en Inventario (Unidades Animales).** Tienen una estructura de "Paquetes" base y cobran un extra por cada animal por encima del límite del paquete. Usuarios ilimitados. |
| **PastureMap** | EE.UU. | Pastoreo regenerativo, mapas visuales, densidades. | **Por cabeza de ganado (Head-based).** Generalmente ofrecen tarifas anuales escalonadas (ej. hasta 500 cabezas, de 500 a 1000, etc.). |
| **Mobble** | Australia | Simplicidad de uso, registro en campo, offline. | **Tarifa Plana por Propiedad (Flat Fee).** No cobran por hectárea ni por animal. Tienen planes como "Core" y "Plus" (este último incluye mapas). Usuarios ilimitados. |

**Conclusión del Benchmark:** El modelo ganador es un **híbrido de SaaS escalonado (Tiers) + Cobro por Unidad Animal (Rango de cabezas)**. Cobrar por usuario limita la adopción en el campo, y cobrar por hectárea no refleja la productividad real.

---

## 2. Estructura de Planes Propuesta (Tiers)

*   **1. Plan "Brote" (Free / Trial):** Productores pequeños o adopción inicial. Motor PLG (Product Led Growth).
*   **2. Plan "Planificador" (Starter / Core):** Operaciones comerciales estándar para organizar el pastoreo diario.
*   **3. Plan "Holístico" (Pro / Advanced):** Enfoque regenerativo. Medición de impacto, NDVI y método Savory.
*   **4. Plan "Latifundio" (Enterprise):** Grupos inversores, multi-campos, APIs corporativas y bonos de carbono.

---

## 3. Distribución de Features

### 🌱 Plan Brote (Free / Trial)
*   **Límites:** Hasta 1 establecimiento, 20 potreros, 200 Unidades Animales (UG/UA).
*   **Features:** Mapeo básico, bitácora de lluvias, cálculo estático de Carga Animal.
*   **Bloqueado:** Planificador Savory, satélites, carbono.
*   **Usuarios:** 1 Admin + 1 Campo.

### 🚜 Plan Planificador (Starter / Core)
*   **Límites:** 1 establecimiento, potreros ilimitados, escalado por tramos (ej. hasta 1,000 UG).
*   **Features:** *Todo lo de Brote +* App móvil offline, planificador de pastoreo (Gantt básico), cálculo dinámico de Carga Animal vs Receptividad, alertas de sanidad e inventario de infraestructura.
*   **Bloqueado:** Savory, NDVI, Carbono.
*   **Usuarios:** Ilimitados.

### 🌿 Plan Holístico (Pro / Advanced) - *[Best Value]*
*   **Límites:** Hasta 3 establecimientos, escalado por tramos (ej. hasta 3,000 UG).
*   **Features:** *Todo lo de Planificador +* **Planificación Forrajera Savory** (presupuesto estacional), **Integración Satelital (NDVI)**, Módulo predictivo (Balance Bio-Económico e Insights), ADA.
*   **Usuarios:** Ilimitados + Permisos granulares.

### 🌍 Plan Latifundio (Enterprise)
*   **Límites:** Establecimientos y UG ilimitados.
*   **Features:** *Todo lo de Holístico +* **Reportes de Carbono e Impacto Ecológico (Certificaciones)**, Dashboard Súper Admin consolidado, API de integraciones (balanzas, ERPs), Soporte prioritario.

---

## 4. Estrategia de Precios (Value-Based Pricing)

| Plan | Rango de Precio (USD) | Justificación de Valor (Value-Based) |
| :--- | :--- | :--- |
| **Brote** | **$0 / mes** | Elimina barrera de entrada. Costo de adquisición (CAC) bajo. |
| **Planificador** | **$49 - $99 / mes** | Equivalente al costo de 3 a 5 rollos de pasto al año. El software se paga solo con ahorrar días de suplemento. |
| **Holístico** | **$149 - $299 / mes** | Reemplaza consultorías caras de vuelos de dron o presupuestos manuales. Aumentar la carga animal un 10% paga la suscripción por años. |
| **Latifundio** | **Custom ($4,000+ / año)** | Retorno gigantesco al acceder a créditos verdes o venta de bonos de carbono. |

**Recomendación:** Facturación Anual por Defecto (alineado al ciclo ganadero) y ofrecer un servicio de "Setup & Onboarding" de pago único como upsell.

---

## 5. El Proceso MRV para Captura de Carbono

RODEO funciona como una plataforma **MRV (Monitoreo, Reporte y Verificación)** para conectar las prácticas del productor con las certificadoras de carbono (como Verra o Savory EOV). No "imprime" bonos, sino que ordena la evidencia digital necesaria.

1. **Evidencia Operativa (Carta de Pastoreo):** El planificador registra de manera inmutable los días de ocupación y descanso, demostrando el cambio hacia un pastoreo planificado y evitando el sobrepastoreo.
2. **Evidencia Ecológica (Bitácora + IA):** Las fotografías georeferenciadas y los datos climáticos demuestran la cobertura del suelo y la salud del pastizal a lo largo del tiempo.
3. **Auditoría (Satélite NDVI):** La integración satelital valida el crecimiento de biomasa a gran escala y se cruza con las muestras físicas de suelo tomadas por el agrónomo.
4. **Emisión y Certificación:** El módulo de Carbono consolida esta información y automatiza el empaquetado de datos requerido por las certificadoras para auditar y emitir los bonos de carbono (tCO₂e), reduciendo drásticamente la fricción y costos de consultoría para el productor.
