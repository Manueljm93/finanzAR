import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { IncomesService } from './incomes.service';
import { EntitiesService } from '../entities/entities.service';
import { Income, IncomePayload, IncomeSummary, Currency } from './income.model';
import { FinancialEntity } from '../entities/entity.model';

@Component({
  selector: 'app-incomes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    CardModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    InputNumberModule, DropdownModule, CalendarModule, TagModule,
    ToastModule, ConfirmDialogModule, TooltipModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="flex flex-column gap-3">
      <!-- Totales + filtros -->
      <div class="flex flex-wrap align-items-center gap-3">
        <div class="totals flex gap-4">
          <div>
            <div class="text-sm text-600">Total ARS</div>
            <div class="text-2xl font-bold text-primary">
              {{ summary?.totalARS ?? 0 | currency:'ARS':'symbol':'1.2-2' }}
            </div>
          </div>
          <div>
            <div class="text-sm text-600">Total USD</div>
            <div class="text-2xl font-bold usd-amount">
              U$S {{ summary?.totalUSD ?? 0 | number:'1.2-2' }}
            </div>
          </div>
        </div>

        <div class="flex align-items-end gap-2 ml-auto">
          <div class="flex flex-column gap-1">
            <label class="text-sm">Mes</label>
            <p-dropdown [options]="months" [(ngModel)]="month" optionLabel="label"
              optionValue="value" (onChange)="reload()" [style]="{'width':'140px'}" />
          </div>
          <div class="flex flex-column gap-1">
            <label class="text-sm">Año</label>
            <p-dropdown [options]="years" [(ngModel)]="year"
              (onChange)="reload()" [style]="{'width':'110px'}" />
          </div>
          <p-button label="Nuevo ingreso" icon="pi pi-plus" (onClick)="openCreate()" />
        </div>
      </div>

      <!-- Tabla -->
      <p-table [value]="incomes" [loading]="loading" styleClass="p-datatable-sm"
        [paginator]="incomes.length > 10" [rows]="10">
        <ng-template pTemplate="header">
          <tr>
            <th style="width:110px">Fecha</th>
            <th>Concepto</th>
            <th style="width:180px">Entidad</th>
            <th style="width:150px" class="text-right">ARS</th>
            <th style="width:150px" class="text-right">USD</th>
            <th style="width:100px"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-income>
          <tr>
            <td>{{ formatDate(income.date) }}</td>
            <td>{{ income.description }}</td>
            <td>
              <span *ngIf="income.entityId; else noEntity">{{ entityName(income.entityId) }}</span>
              <ng-template #noEntity><span class="text-500">—</span></ng-template>
            </td>
            <td class="text-right">
              <span *ngIf="income.currency === 'ARS'">{{ income.amount | currency:'ARS':'symbol':'1.2-2' }}</span>
              <span *ngIf="income.currency !== 'ARS'" class="text-500">—</span>
            </td>
            <td class="text-right">
              <span *ngIf="income.currency === 'USD'">U$S {{ income.amount | number:'1.2-2' }}</span>
              <span *ngIf="income.currency !== 'USD'" class="text-500">—</span>
            </td>
            <td class="text-right">
              <p-button icon="pi pi-pencil" [text]="true" severity="secondary"
                (onClick)="openEdit(income)" pTooltip="Editar" />
              <p-button icon="pi pi-trash" [text]="true" severity="danger"
                (onClick)="confirmDelete(income)" pTooltip="Eliminar" />
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="6" class="text-center text-600 p-4">No hay ingresos en este período.</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Diálogo alta/edición -->
    <p-dialog [(visible)]="dialogVisible" [header]="editingId ? 'Editar ingreso' : 'Nuevo ingreso'"
      [modal]="true" [style]="{'width':'440px'}" [draggable]="false">
      <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-column gap-3 pt-2">
        <div class="flex flex-column gap-1">
          <label for="date">Fecha</label>
          <p-calendar inputId="date" formControlName="date" dateFormat="dd/mm/yy"
            [showIcon]="true" [style]="{'width':'100%'}" appendTo="body" />
        </div>
        <div class="flex flex-column gap-1">
          <label for="description">Concepto</label>
          <input pInputText id="description" formControlName="description"
            placeholder="Ej: Factura cliente exterior" />
        </div>
        <div class="flex gap-2">
          <div class="flex flex-column gap-1 flex-1">
            <label for="amount">Monto</label>
            <p-inputNumber inputId="amount" formControlName="amount" mode="decimal"
              [minFractionDigits]="2" [maxFractionDigits]="2" [style]="{'width':'100%'}" />
          </div>
          <div class="flex flex-column gap-1" style="width:120px">
            <label>Moneda</label>
            <p-dropdown [options]="currencies" formControlName="currency" [style]="{'width':'100%'}" />
          </div>
        </div>
        <div class="flex flex-column gap-1">
          <label>Entidad <span class="text-500 text-sm">(opcional)</span></label>
          <p-dropdown [options]="entities" formControlName="entityId" optionLabel="name"
            optionValue="id" placeholder="Sin entidad" [showClear]="true" [style]="{'width':'100%'}"
            appendTo="body" />
        </div>

        <div class="flex justify-content-end gap-2 pt-2">
          <p-button label="Cancelar" severity="secondary" [text]="true"
            (onClick)="dialogVisible = false" type="button" />
          <p-button label="Guardar" icon="pi pi-check" type="submit"
            [loading]="saving" [disabled]="form.invalid" />
        </div>
      </form>
    </p-dialog>
  `,
  styles: [`
    .totals { background:var(--surface-card); border:1px solid var(--surface-border); padding:1rem 1.5rem; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
  `]
})
export class IncomesComponent implements OnInit {
  private incomesSvc = inject(IncomesService);
  private entitiesSvc = inject(EntitiesService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmationService);
  private toast = inject(MessageService);

  incomes: Income[] = [];
  entities: FinancialEntity[] = [];
  summary?: IncomeSummary;
  loading = false;
  saving = false;

  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;

  dialogVisible = false;
  editingId: string | null = null;

  currencies: Currency[] = ['ARS', 'USD'];
  months = Array.from({ length: 12 }, (_, i) => ({
    label: this.capitalize(new Date(2000, i, 1).toLocaleString('es-AR', { month: 'long' })),
    value: i + 1
  }));
  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  form = this.fb.group({
    date: [new Date(), Validators.required],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['ARS' as Currency, Validators.required],
    entityId: [null as string | null]
  });

  ngOnInit() {
    this.entitiesSvc.list().subscribe(data => this.entities = data);
    this.reload();
  }

  reload() {
    this.loading = true;
    forkJoin({
      list: this.incomesSvc.list(this.year, this.month),
      summary: this.incomesSvc.summary(this.year, this.month)
    }).subscribe({
      next: ({ list, summary }) => {
        this.incomes = list;
        this.summary = summary;
        this.loading = false;
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los ingresos.' });
        this.loading = false;
      }
    });
  }

  openCreate() {
    this.editingId = null;
    this.form.reset({ date: new Date(), description: '', amount: null, currency: 'ARS', entityId: null });
    this.dialogVisible = true;
  }

  openEdit(income: Income) {
    this.editingId = income.id;
    this.form.reset({
      date: this.parseDate(income.date),
      description: income.description,
      amount: income.amount,
      currency: income.currency,
      entityId: income.entityId
    });
    this.dialogVisible = true;
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const payload: IncomePayload = {
      amount: v.amount!,
      currency: v.currency!,
      date: this.toIsoDate(v.date!),
      description: v.description!.trim(),
      entityId: v.entityId ?? null
    };

    const req = this.editingId
      ? this.incomesSvc.update(this.editingId, payload)
      : this.incomesSvc.create(payload);

    req.subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: this.editingId ? 'Actualizado' : 'Creado',
          detail: 'Ingreso guardado correctamente.'
        });
        this.dialogVisible = false;
        this.saving = false;
        this.reload();
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el ingreso.' });
        this.saving = false;
      }
    });
  }

  confirmDelete(income: Income) {
    this.confirm.confirm({
      message: `¿Eliminar el ingreso "${income.description}"?`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.incomesSvc.delete(income.id).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Ingreso eliminado.' });
            this.reload();
          },
          error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' })
        });
      }
    });
  }

  entityName(id: string): string {
    return this.entities.find(e => e.id === id)?.name ?? '—';
  }

  formatDate(iso: string): string {
    const d = this.parseDate(iso);
    return d.toLocaleDateString('es-AR');
  }

  private parseDate(iso: string): Date {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private toIsoDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
