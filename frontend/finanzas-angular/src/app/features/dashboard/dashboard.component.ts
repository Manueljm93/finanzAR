import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';

import { IncomesService } from '../incomes/incomes.service';
import { EntitiesService } from '../entities/entities.service';
import { MonotributoService } from '../monotributo/monotributo.service';
import { Category } from '../monotributo/monotributo.model';
import { DolarService } from './dolar.service';
import { DolarRate } from './dolar.model';

interface EntitySlice {
  name: string;
  amount: number;
  pct: number;
}

interface MonthBar {
  name: string;
  amount: number;
  heightPct: number;
  best: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, CardModule, TagModule, ProgressBarModule, ButtonModule, TableModule],
  template: `
    <div class="flex flex-column gap-3">
      <div class="flex align-items-center justify-content-between">
        <h2 style="margin:0">Resumen {{ year }}</h2>
        <p-button label="Ir a ingresos" icon="pi pi-arrow-right" iconPos="right"
          routerLink="/incomes" />
      </div>

      <!-- KPIs -->
      <div class="grid">
        <div class="col-6 lg:col-3">
          <p-card>
            <div class="text-sm text-600">Facturado {{ year }} (ARS)</div>
            <div class="text-2xl font-bold text-primary">{{ totalARS | currency:'ARS':'symbol':'1.0-0' }}</div>
          </p-card>
        </div>
        <div class="col-6 lg:col-3">
          <p-card>
            <div class="text-sm text-600">Facturado {{ year }} (USD)</div>
            <div class="text-2xl font-bold usd-amount">U$S {{ totalUSD | number:'1.0-0' }}</div>
          </p-card>
        </div>
        <div class="col-6 lg:col-3">
          <p-card>
            <div class="text-sm text-600">Promedio mensual (ARS)</div>
            <div class="text-2xl font-bold">{{ promedioMensual | currency:'ARS':'symbol':'1.0-0' }}</div>
            <div class="text-xs text-500">{{ closedMonths }} {{ closedMonths === 1 ? 'mes cerrado' : 'meses cerrados' }}</div>
          </p-card>
        </div>
        <div class="col-6 lg:col-3">
          <p-card>
            <div class="text-sm text-600">Ingresos registrados</div>
            <div class="text-2xl font-bold">{{ count }}</div>
            <div class="text-xs text-500" *ngIf="bestMonthName">Mejor mes: {{ bestMonthName }}</div>
          </p-card>
        </div>
      </div>

      <div class="grid">
        <!-- Distribución por entidad -->
        <div class="col-12 lg:col-6">
          <p-card header="Distribución por entidad (ARS)">
            <div *ngIf="slices.length; else noData" class="flex flex-column gap-3">
              <div *ngFor="let s of slices">
                <div class="flex justify-content-between text-sm mb-1">
                  <span class="font-medium">{{ s.name }}</span>
                  <span class="text-600">{{ s.amount | currency:'ARS':'symbol':'1.0-0' }} · {{ s.pct | number:'1.0-1' }}%</span>
                </div>
                <div class="bar-track">
                  <div class="bar-fill" [style.width.%]="s.pct"></div>
                </div>
              </div>
            </div>
            <ng-template #noData><div class="text-600 p-3 text-center">Sin ingresos en {{ year }}.</div></ng-template>
          </p-card>
        </div>

        <!-- Monotributo -->
        <div class="col-12 lg:col-6">
          <p-card header="Monotributo">
            <div class="flex align-items-center gap-3 mb-3">
              <p-tag [value]="category?.letter || '—'" severity="info" styleClass="text-2xl px-3 py-2" />
              <div class="flex-1">
                <div class="text-sm text-600">Acumulado anual (ARS)</div>
                <div class="text-xl font-bold">{{ totalARS | currency:'ARS':'symbol':'1.0-0' }}</div>
              </div>
            </div>
            <div *ngIf="category as cat">
              <div class="flex justify-content-between text-sm mb-1">
                <span class="text-600">Límite cat. {{ cat.letter }}</span>
                <span>{{ cat.maxAnnualIncome | currency:'ARS':'symbol':'1.0-0' }}</span>
              </div>
              <p-progressBar [value]="progressPct" [showValue]="false" />
              <div *ngIf="nextCategory as nxt" class="text-sm text-600 mt-2">
                Faltan <b>{{ nxt.maxAnnualIncome - totalARS | currency:'ARS':'symbol':'1.0-0' }}</b>
                para categoría {{ nxt.letter }}.
              </div>
            </div>
          </p-card>
        </div>
      </div>

      <!-- Evolución mensual -->
      <p-card header="Evolución mensual {{ year }} (ARS)">
        <div class="bars-chart">
          <div *ngFor="let b of monthBars" class="bar-col">
            <div class="bar-val">{{ b.amount > 0 ? compact(b.amount) : '' }}</div>
            <div class="bar-vert-track">
              <div class="bar-vert-fill" [class.best]="b.best" [style.height.%]="b.heightPct"></div>
            </div>
            <div class="bar-label">{{ b.name }}</div>
          </div>
        </div>
      </p-card>

      <!-- Cotizaciones del dólar -->
      <p-card header="Cotizaciones del dólar (Argentina)">
        <div *ngIf="dolarError" class="text-600 p-3 text-center">
          No se pudieron cargar las cotizaciones en este momento.
        </div>
        <p-table *ngIf="!dolarError" [value]="dolares" styleClass="p-datatable-sm" [loading]="dolarLoading">
          <ng-template pTemplate="header">
            <tr>
              <th>Tipo</th>
              <th class="text-right">Compra</th>
              <th class="text-right">Venta</th>
              <th class="text-right">Actualizado</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-d>
            <tr>
              <td class="font-medium">{{ d.nombre }}</td>
              <td class="text-right">{{ d.compra | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="text-right font-bold">{{ d.venta | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="text-right text-500 text-sm">{{ formatFecha(d.fechaActualizacion) }}</td>
            </tr>
          </ng-template>
        </p-table>
        <small class="text-500 block mt-2">Fuente: dolarapi.com — valores por 1 USD en ARS.</small>
      </p-card>
    </div>
  `,
  styles: [`
    h2 { font-size:1.5rem; }
    .bar-track { background:var(--surface-200); border-radius:4px; height:10px; overflow:hidden; }
    .bar-fill { background:var(--primary-color); height:100%; border-radius:4px; }

    .bars-chart { display:flex; align-items:flex-end; gap:.5rem; height:200px; padding-top:1rem; }
    .bar-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; }
    .bar-val { font-size:.7rem; color:var(--text-color-secondary); height:1rem; }
    .bar-vert-track { flex:1; width:60%; display:flex; align-items:flex-end; }
    .bar-vert-fill { width:100%; background:var(--surface-400); border-radius:4px 4px 0 0; min-height:2px; transition:height .3s; }
    .bar-vert-fill.best { background:var(--primary-color); }
    .bar-label { font-size:.7rem; color:var(--text-color-secondary); margin-top:.35rem; }
  `]
})
export class DashboardComponent implements OnInit {
  private incomesSvc = inject(IncomesService);
  private entitiesSvc = inject(EntitiesService);
  private monoSvc = inject(MonotributoService);
  private dolarSvc = inject(DolarService);

  private readonly monthAbbr = Array.from({ length: 12 }, (_, i) =>
    this.capitalize(new Date(2000, i, 1).toLocaleString('es-AR', { month: 'short' }).replace('.', '')));

  year = new Date().getFullYear();
  private currentMonth = new Date().getMonth() + 1;

  totalARS = 0;
  totalUSD = 0;
  count = 0;
  promedioMensual = 0;
  closedMonths = 0;
  bestMonthName = '';

  slices: EntitySlice[] = [];
  monthBars: MonthBar[] = [];

  category: Category | null = null;
  nextCategory: Category | null = null;
  progressPct = 0;

  dolares: DolarRate[] = [];
  dolarLoading = true;
  dolarError = false;

  ngOnInit() {
    this.dolarSvc.getAll().subscribe({
      next: (rates) => { this.dolares = rates; this.dolarLoading = false; },
      error: () => { this.dolarError = true; this.dolarLoading = false; }
    });

    forkJoin({
      incomes: this.incomesSvc.listByYear(this.year),
      entities: this.entitiesSvc.list(),
      categories: this.monoSvc.getCategories()
    }).subscribe(({ incomes, entities, categories }) => {
      const entityName = new Map(entities.map(e => [e.id, e.name]));
      const cats = [...categories].sort((a, b) => a.maxAnnualIncome - b.maxAnnualIncome);

      const arsByMonth = new Array(13).fill(0);
      const byEntity = new Map<string, number>();

      for (const inc of incomes) {
        if (inc.currency === 'ARS') {
          this.totalARS += inc.amount;
          arsByMonth[inc.month] += inc.amount;
          const key = inc.entityId ? entityName.get(inc.entityId) ?? 'Entidad desconocida' : 'Sin entidad';
          byEntity.set(key, (byEntity.get(key) ?? 0) + inc.amount);
        } else {
          this.totalUSD += inc.amount;
        }
      }
      this.count = incomes.length;

      // Promedio sobre meses cerrados (transcurridos)
      this.closedMonths = this.year < new Date().getFullYear() ? 12 : Math.max(0, this.currentMonth - 1);
      const closedSum = arsByMonth.slice(1, this.closedMonths + 1).reduce((a, b) => a + b, 0);
      this.promedioMensual = this.closedMonths > 0 ? closedSum / this.closedMonths : 0;

      // Distribución por entidad
      this.slices = [...byEntity.entries()]
        .map(([name, amount]) => ({ name, amount, pct: this.totalARS > 0 ? (amount / this.totalARS) * 100 : 0 }))
        .sort((a, b) => b.amount - a.amount);

      // Evolución mensual
      const maxMonth = Math.max(...arsByMonth.slice(1), 0);
      let bestMonth = 0;
      for (let m = 1; m <= 12; m++) if (arsByMonth[m] > arsByMonth[bestMonth] || bestMonth === 0) bestMonth = m;
      this.bestMonthName = maxMonth > 0 ? this.capitalize(new Date(2000, bestMonth - 1, 1).toLocaleString('es-AR', { month: 'long' })) : '';
      this.monthBars = this.monthAbbr.map((name, i) => {
        const amount = arsByMonth[i + 1];
        return {
          name,
          amount,
          heightPct: maxMonth > 0 ? (amount / maxMonth) * 100 : 0,
          best: maxMonth > 0 && i + 1 === bestMonth
        };
      });

      // Monotributo
      const idx = cats.findIndex(c => c.maxAnnualIncome >= this.totalARS);
      this.category = idx >= 0 ? cats[idx] : (cats.at(-1) ?? null);
      this.nextCategory = idx >= 0 && idx < cats.length - 1 ? cats[idx + 1] : null;
      this.progressPct = this.category ? Math.min(100, (this.totalARS / this.category.maxAnnualIncome) * 100) : 0;
    });
  }

  compact(n: number): string {
    if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'M';
    if (n >= 1_000) return '$' + Math.round(n / 1_000) + 'k';
    return '$' + Math.round(n);
  }

  formatFecha(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-AR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
    });
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
