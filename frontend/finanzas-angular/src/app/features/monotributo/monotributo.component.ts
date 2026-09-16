import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

import { MonotributoService } from './monotributo.service';
import { IncomesService } from '../incomes/incomes.service';
import { Category, CategoryStatus, MonthDetail } from './monotributo.model';

@Component({
  selector: 'app-monotributo',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    CardModule, TableModule, ButtonModule, InputNumberModule,
    ProgressBarModule, TagModule, DropdownModule, ToastModule
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="flex flex-column gap-3">
      <div class="flex align-items-center">
        <h2 style="margin:0">Control de Monotributo</h2>
        <div class="flex flex-column gap-1 ml-auto" style="width:120px">
          <label class="text-sm">Año</label>
          <p-dropdown [options]="years" [(ngModel)]="year" (onChange)="reload()" />
        </div>
      </div>

      <div class="grid">
        <!-- Categoría actual (real) -->
        <div class="col-12 lg:col-7">
          <p-card header="Categoría actual (según lo facturado)">
            <div class="flex align-items-center gap-3 mb-3">
              <p-tag [value]="status?.current?.letter || '—'"
                [severity]="status?.overTop ? 'danger' : 'info'"
                styleClass="text-2xl px-3 py-2" />
              <div class="flex-1">
                <div class="text-sm text-600">Acumulado anual facturado (ARS)</div>
                <div class="text-2xl font-bold">{{ status?.accumulated ?? 0 | currency:'ARS':'symbol':'1.2-2' }}</div>
              </div>
            </div>

            <div *ngIf="status?.current as cat">
              <div class="flex justify-content-between text-sm mb-1">
                <span class="text-600">Límite cat. {{ cat.letter }}</span>
                <span>{{ cat.maxAnnualIncome | currency:'ARS':'symbol':'1.0-0' }}</span>
              </div>
              <p-progressBar [value]="status!.progressPct" [showValue]="false"
                [styleClass]="status!.progressPct >= 90 ? 'pbar-danger' : ''" />
              <div class="flex justify-content-between text-sm mt-2">
                <span class="text-600">Costo mensual cat. {{ cat.letter }}</span>
                <span class="font-medium">{{ cat.totalMonthly | currency:'ARS':'symbol':'1.2-2' }}</span>
              </div>
            </div>

            <div *ngIf="status?.next as nxt; else atTop" class="mt-3 p-2 border-round callout callout-warn">
              <i class="pi pi-arrow-up mr-1"></i>
              Faltan <b>{{ status!.remainingToNext | currency:'ARS':'symbol':'1.2-2' }}</b>
              para pasar a categoría <b>{{ nxt.letter }}</b>.
            </div>
            <ng-template #atTop>
              <div *ngIf="status?.overTop" class="mt-3 p-2 border-round callout callout-danger">
                <i class="pi pi-exclamation-triangle mr-1"></i>
                Superaste el tope de Monotributo (cat. K). Deberías evaluar pasar a Responsable Inscripto.
              </div>
            </ng-template>
          </p-card>
        </div>

        <!-- Meta mensual + a favor + proyección -->
        <div class="col-12 lg:col-5">
          <p-card header="Meta mensual">
            <div class="flex flex-column gap-2">
              <label class="text-sm text-600">¿Cuánto querés facturar por mes?</label>
              <div class="flex gap-2">
                <p-inputNumber [(ngModel)]="metaInput" (ngModelChange)="onMetaChange()"
                  mode="currency" currency="ARS" locale="es-AR"
                  [style]="{'width':'100%'}" [inputStyle]="{'width':'100%'}" />
                <p-button icon="pi pi-check" label="Guardar" (onClick)="saveMeta()"
                  [loading]="savingMeta" [disabled]="!metaInput || metaInput <= 0" />
              </div>
              <small *ngIf="goalAmount === 0" class="text-orange-600">
                Meta sugerida — guardá para fijarla.
              </small>

              <hr class="w-full" style="border:none;border-top:1px solid var(--surface-border);margin:0.5rem 0" />

              <div class="flex justify-content-between">
                <span class="text-600">Facturado {{ rangeLabel }}</span>
                <span class="font-medium">{{ totalFacturado | currency:'ARS':'symbol':'1.0-0' }}</span>
              </div>
              <div class="flex justify-content-between">
                <span class="text-600">Meta acumulada ({{ computableCount }} {{ computableCount === 1 ? 'mes' : 'meses' }})</span>
                <span class="font-medium">{{ totalMeta | currency:'ARS':'symbol':'1.0-0' }}</span>
              </div>
              <div class="flex justify-content-between text-lg pt-1" style="border-top:1px solid var(--surface-border)">
                <span class="font-bold" [ngClass]="aFavorPositive ? 'amount-pos' : 'amount-neg'">
                  {{ aFavorPositive ? 'A favor' : 'Te falta' }}
                </span>
                <span class="font-bold" [ngClass]="aFavorPositive ? 'amount-pos' : 'amount-neg'">
                  {{ aFavorPositive ? '+' : '' }}{{ totalAFavorAbs | currency:'ARS':'symbol':'1.0-0' }}
                </span>
              </div>

              <div class="mt-2 p-2 border-round callout callout-success">
                <div class="text-sm text-600">Proyección a fin de año</div>
                <div class="flex align-items-center gap-2 mt-1">
                  <span class="font-bold">{{ projectedAnnual | currency:'ARS':'symbol':'1.0-0' }}</span>
                  <span class="text-600">→ caerías en</span>
                  <p-tag [value]="projectedCategory?.letter || '—'"
                    [severity]="projectedOver ? 'danger' : 'success'" />
                </div>
                <div class="text-xs text-500 mt-1">
                  = facturado {{ rangeLabel }} + meta × {{ remainingMonths }} {{ remainingMonths === 1 ? 'mes' : 'meses' }} restantes
                </div>
              </div>
            </div>
          </p-card>
        </div>
      </div>

      <!-- Detalle mes a mes -->
      <p-card header="Detalle mes a mes">
        <p-table [value]="detail" styleClass="p-datatable-sm" [loading]="loading">
          <ng-template pTemplate="header">
            <tr>
              <th>Mes</th>
              <th class="text-right">Facturado</th>
              <th class="text-right">Meta</th>
              <th class="text-right">Diferencia</th>
              <th class="text-right">Acumulado</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-row>
            <tr [style.opacity]="row.computable || (row.month === currentMonth && year === currentYear) ? 1 : 0.45">
              <td>
                {{ row.monthName }}
                <span *ngIf="row.month === currentMonth && year === currentYear"
                  class="text-xs text-500">(en curso)</span>
              </td>
              <td class="text-right">{{ row.facturado | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="text-right text-600">{{ row.meta | currency:'ARS':'symbol':'1.0-0' }}</td>
              <td class="text-right" [ngClass]="row.aFavor >= 0 ? 'amount-pos' : 'amount-neg'"
                *ngIf="row.computable; else dashFavor">
                {{ row.aFavor >= 0 ? '+' : '' }}{{ row.aFavor | currency:'ARS':'symbol':'1.0-0' }}
              </td>
              <ng-template #dashFavor><td class="text-right text-500">—</td></ng-template>
              <td class="text-right font-medium"
                [ngClass]="row.acumuladoAFavor < 0 ? 'amount-neg' : 'amount-pos'"
                *ngIf="row.acumuladoAFavor !== null; else dashAcum">
                {{ row.acumuladoAFavor >= 0 ? '+' : '' }}{{ row.acumuladoAFavor | currency:'ARS':'symbol':'1.0-0' }}
              </td>
              <ng-template #dashAcum><td class="text-right text-500">—</td></ng-template>
            </tr>
          </ng-template>
        </p-table>
        <small class="text-500 block mt-2">
          "Diferencia" = facturado − meta (verde = a favor, rojo = falta). Solo se acumulan los meses cerrados; los futuros se muestran en gris.
        </small>
      </p-card>

      <!-- Grilla completa de categorías ARCA/AFIP (proyección) -->
      <p-card header="Grilla de categorías (ARCA / AFIP) — proyección a fin de año">
        <p-table [value]="categories" styleClass="p-datatable-sm" [loading]="loading">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:60px">Cat.</th>
              <th class="text-right">Ingresos brutos anuales (hasta)</th>
              <th class="text-right">Impuesto integrado</th>
              <th class="text-right">Aportes SIPA</th>
              <th class="text-right">Obra social</th>
              <th class="text-right">Total mensual</th>
              <th style="width:170px"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-cat>
            <tr [ngClass]="rowClass(cat)"
              [style.font-weight]="cat.letter === projectedCategory?.letter ? '700' : '400'">
              <td><b>{{ cat.letter }}</b></td>
              <td class="text-right">{{ cat.maxAnnualIncome | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="text-right">{{ cat.integratedTax | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="text-right">{{ cat.sipaContribution | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="text-right">{{ cat.socialSecurity | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="text-right">{{ cat.totalMonthly | currency:'ARS':'symbol':'1.2-2' }}</td>
              <td class="white-space-nowrap">
                <span *ngIf="cat.letter === projectedCategory?.letter" class="text-primary font-bold">
                  <i class="pi pi-arrow-left"></i> Caerías acá
                </span>
                <span *ngIf="cat.letter === status?.current?.letter && cat.letter !== projectedCategory?.letter"
                  class="text-500 text-sm">hoy</span>
                <span *ngIf="cat.letter === projectedCategory?.letter && cat.letter === status?.current?.letter"
                  class="text-500 text-sm ml-1">(y hoy)</span>
              </td>
            </tr>
          </ng-template>
        </p-table>
        <small class="text-500 block mt-2">
          Resaltado = dónde <b>caerías a fin de año</b> facturando {{ metaInput | currency:'ARS':'symbol':'1.0-0' }}/mes lo que resta.
          <span class="text-500">"hoy"</span> = tu categoría actual según lo ya facturado.
          Grilla vigente desde 01/02/2026 (locaciones y prestaciones de servicios). Fuente: ARCA/AFIP.
        </small>
      </p-card>
    </div>
  `,
  styles: [`
    :host ::ng-deep .pbar-danger .p-progressbar-value { background:#c62828; }
    h2 { font-size:1.5rem; }
  `]
})
export class MonotributoComponent implements OnInit {
  private monoSvc = inject(MonotributoService);
  private incomesSvc = inject(IncomesService);
  private toast = inject(MessageService);

  private readonly DEFAULT_META = 5_000_000;
  private readonly monthNames = Array.from({ length: 12 }, (_, i) =>
    this.capitalize(new Date(2000, i, 1).toLocaleString('es-AR', { month: 'long' })));

  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth() + 1;
  year = this.currentYear;
  years = Array.from({ length: 5 }, (_, i) => this.currentYear - i);

  categories: Category[] = [];
  goalAmount = 0;
  metaInput: number | null = this.DEFAULT_META;
  loading = false;
  savingMeta = false;

  private arsByMonth: number[] = new Array(13).fill(0);

  detail: MonthDetail[] = [];
  status?: CategoryStatus;

  // resumen a favor
  totalFacturado = 0;
  totalMeta = 0;
  totalAFavorAbs = 0;
  aFavorPositive = true;
  computableCount = 0;
  rangeLabel = '';

  // proyección
  projectedAnnual = 0;
  projectedCategory: Category | null = null;
  projectedOver = false;
  remainingMonths = 0;

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading = true;
    forkJoin({
      categories: this.monoSvc.getCategories(),
      goal: this.monoSvc.getGoal(),
      incomes: this.incomesSvc.listByYear(this.year)
    }).subscribe({
      next: ({ categories, goal, incomes }) => {
        this.categories = [...categories].sort((a, b) => a.maxAnnualIncome - b.maxAnnualIncome);
        this.goalAmount = goal.amount;
        this.metaInput = goal.amount > 0 ? goal.amount : this.DEFAULT_META;

        this.arsByMonth = new Array(13).fill(0);
        for (const inc of incomes) {
          if (inc.currency === 'ARS') this.arsByMonth[inc.month] += inc.amount;
        }
        this.recompute();
        this.loading = false;
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar el control de monotributo.' });
        this.loading = false;
      }
    });
  }

  onMetaChange() {
    // recálculo local en vivo (sin pedir datos de nuevo)
    if (this.categories.length) this.recompute();
  }

  private recompute() {
    const meta = this.metaInput ?? this.DEFAULT_META;
    const accumulated = this.arsByMonth.reduce((a, b) => a + b, 0);

    // Categoría actual (real, según lo facturado)
    const cur = this.categoryFor(accumulated);
    const idx = cur.cat ? this.categories.indexOf(cur.cat) : -1;
    const next = (!cur.over && idx >= 0 && idx < this.categories.length - 1)
      ? this.categories[idx + 1] : null;
    this.status = {
      current: cur.cat,
      next,
      accumulated,
      remainingToNext: next ? next.maxAnnualIncome - accumulated : null,
      progressPct: cur.cat ? Math.min(100, (accumulated / cur.cat.maxAnnualIncome) * 100) : 0,
      overTop: cur.over
    };

    // Mes a mes (solo meses cerrados acumulan)
    let running = 0;
    this.computableCount = 0;
    this.totalFacturado = 0;
    let lastClosedMonth = 0;

    this.detail = this.monthNames.map((name, i) => {
      const month = i + 1;
      const facturado = this.arsByMonth[month];
      const computable = this.isComputable(month);
      const aFavor = facturado - meta;
      let acumuladoAFavor: number | null = null;
      if (computable) {
        running += aFavor;
        acumuladoAFavor = running;
        this.computableCount++;
        this.totalFacturado += facturado;
        lastClosedMonth = month;
      }
      return { month, monthName: name, facturado, meta, aFavor, acumuladoAFavor, computable };
    });

    this.totalMeta = meta * this.computableCount;
    const totalAFavor = this.totalFacturado - this.totalMeta;
    this.aFavorPositive = totalAFavor >= 0;
    this.totalAFavorAbs = Math.abs(totalAFavor);
    this.rangeLabel = lastClosedMonth > 0
      ? `(ene–${this.monthNames[lastClosedMonth - 1].slice(0, 3).toLowerCase()})`
      : '';

    // Proyección a fin de año: lo facturado en meses cerrados + meta por los meses restantes
    const closedCount = this.detail.filter(d => d.computable).length;
    this.remainingMonths = 12 - closedCount;
    this.projectedAnnual = this.totalFacturado + meta * this.remainingMonths;
    const proj = this.categoryFor(this.projectedAnnual);
    this.projectedCategory = proj.cat;
    this.projectedOver = proj.over;
  }

  private categoryFor(amount: number): { cat: Category | null; over: boolean } {
    let cat = this.categories.find(c => c.maxAnnualIncome >= amount) ?? null;
    const over = cat === null && this.categories.length > 0;
    if (over) cat = this.categories[this.categories.length - 1];
    return { cat, over };
  }

  private isComputable(month: number): boolean {
    if (this.year < this.currentYear) return true;
    if (this.year > this.currentYear) return false;
    return month < this.currentMonth;
  }

  rowClass(cat: Category): string {
    if (cat.letter === this.projectedCategory?.letter) return 'row-projected';
    if (cat.letter === this.status?.current?.letter) return 'row-current';
    return '';
  }

  saveMeta() {
    if (!this.metaInput || this.metaInput <= 0) return;
    this.savingMeta = true;
    this.monoSvc.setGoal(this.metaInput).subscribe({
      next: (res) => {
        this.goalAmount = res.amount;
        this.toast.add({ severity: 'success', summary: 'Meta guardada', detail: 'Tu meta mensual se actualizó.' });
        this.savingMeta = false;
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar la meta.' });
        this.savingMeta = false;
      }
    });
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
