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
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmationService, MessageService } from 'primeng/api';

import { ExpensesService } from './expenses.service';
import {
  MonthlyExpense, FixedExpensePayload, ExpenseSummary, Currency, ExpenseCategory
} from './expense.model';

@Component({
  selector: 'app-expenses',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    CardModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    InputNumberModule, DropdownModule, TagModule,
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
            <div class="text-sm text-600">Total mes (ARS)</div>
            <div class="text-2xl font-bold text-primary">
              {{ summary?.totalARS ?? 0 | currency:'ARS':'symbol':'1.2-2' }}
            </div>
          </div>
          <div>
            <div class="text-sm text-600">Pendiente (ARS)</div>
            <div class="text-2xl font-bold pending-amount">
              {{ summary?.pendingARS ?? 0 | currency:'ARS':'symbol':'1.2-2' }}
            </div>
          </div>
          <div *ngIf="(summary?.totalUSD ?? 0) > 0">
            <div class="text-sm text-600">Total mes (USD)</div>
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
          <p-button label="Nuevo gasto fijo" icon="pi pi-plus" (onClick)="openCreate()" />
        </div>
      </div>

      <div *ngIf="summary" class="text-sm text-600">
        {{ summary.paidCount }} de {{ summary.count }} gastos pagados ·
        Pagado {{ summary.paidARS | currency:'ARS':'symbol':'1.0-0' }}
      </div>

      <!-- Tabla -->
      <p-table [value]="expenses" [loading]="loading" styleClass="p-datatable-sm"
        [paginator]="expenses.length > 12" [rows]="12">
        <ng-template pTemplate="header">
          <tr>
            <th style="width:70px" class="text-center">Vto.</th>
            <th>Concepto</th>
            <th style="width:130px">Categoría</th>
            <th style="width:150px" class="text-right">ARS</th>
            <th style="width:150px" class="text-right">USD</th>
            <th style="width:140px" class="text-center">Estado</th>
            <th style="width:100px"></th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-e>
          <tr [class.row-paid]="e.paid">
            <td class="text-center">{{ e.dueDay }}</td>
            <td>{{ e.description }}</td>
            <td><p-tag [value]="e.category" [severity]="categorySeverity(e.category)" /></td>
            <td class="text-right">
              <span *ngIf="e.currency === 'ARS'">{{ e.amount | currency:'ARS':'symbol':'1.2-2' }}</span>
              <span *ngIf="e.currency !== 'ARS'" class="text-500">—</span>
            </td>
            <td class="text-right">
              <span *ngIf="e.currency === 'USD'">U$S {{ e.amount | number:'1.2-2' }}</span>
              <span *ngIf="e.currency !== 'USD'" class="text-500">—</span>
            </td>
            <td class="text-center">
              <p-button [label]="e.paid ? 'Pagado' : 'Pendiente'"
                [icon]="e.paid ? 'pi pi-check-circle' : 'pi pi-clock'"
                [severity]="e.paid ? 'success' : 'secondary'"
                [text]="!e.paid" size="small"
                [loading]="togglingId === e.fixedExpenseId"
                (onClick)="togglePaid(e)"
                [pTooltip]="e.paid && e.paidAt ? ('Pagado el ' + formatDate(e.paidAt)) : 'Marcar como pagado'" />
            </td>
            <td class="text-right">
              <p-button icon="pi pi-pencil" [text]="true" severity="secondary"
                (onClick)="openEdit(e)" pTooltip="Editar" />
              <p-button icon="pi pi-trash" [text]="true" severity="danger"
                (onClick)="confirmDelete(e)" pTooltip="Eliminar" />
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7" class="text-center text-600 p-4">
            No hay gastos fijos cargados. Creá el primero con "Nuevo gasto fijo".
          </td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- Diálogo alta/edición -->
    <p-dialog [(visible)]="dialogVisible" [header]="editingId ? 'Editar gasto fijo' : 'Nuevo gasto fijo'"
      [modal]="true" [style]="{'width':'440px'}" [draggable]="false">
      <form [formGroup]="form" (ngSubmit)="save()" class="flex flex-column gap-3 pt-2">
        <div class="flex flex-column gap-1">
          <label for="description">Concepto</label>
          <input pInputText id="description" formControlName="description"
            placeholder="Ej: Alquiler, AFIP Monotributo, Luz" />
        </div>
        <div class="flex gap-2">
          <div class="flex flex-column gap-1 flex-1">
            <label>Categoría</label>
            <p-dropdown [options]="categories" formControlName="category"
              [style]="{'width':'100%'}" appendTo="body" />
          </div>
          <div class="flex flex-column gap-1" style="width:130px">
            <label for="dueDay">Día de vto.</label>
            <p-inputNumber inputId="dueDay" formControlName="dueDay" [min]="1" [max]="31"
              [showButtons]="true" [style]="{'width':'100%'}" />
          </div>
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
    .pending-amount { color:var(--orange-500); }
    .row-paid td { opacity:.6; }
  `]
})
export class ExpensesComponent implements OnInit {
  private expensesSvc = inject(ExpensesService);
  private fb = inject(FormBuilder);
  private confirm = inject(ConfirmationService);
  private toast = inject(MessageService);

  expenses: MonthlyExpense[] = [];
  summary?: ExpenseSummary;
  loading = false;
  saving = false;
  togglingId: string | null = null;

  year = new Date().getFullYear();
  month = new Date().getMonth() + 1;

  dialogVisible = false;
  editingId: string | null = null;

  currencies: Currency[] = ['ARS', 'USD'];
  categories: ExpenseCategory[] = ['Impuesto', 'Servicio', 'Alquiler', 'Pago', 'Otro'];
  months = Array.from({ length: 12 }, (_, i) => ({
    label: this.capitalize(new Date(2000, i, 1).toLocaleString('es-AR', { month: 'long' })),
    value: i + 1
  }));
  years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  form = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(500)]],
    category: ['Servicio' as ExpenseCategory, Validators.required],
    dueDay: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
    amount: [null as number | null, [Validators.required, Validators.min(0.01)]],
    currency: ['ARS' as Currency, Validators.required]
  });

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading = true;
    forkJoin({
      month: this.expensesSvc.month(this.year, this.month),
      summary: this.expensesSvc.summary(this.year, this.month)
    }).subscribe({
      next: ({ month, summary }) => {
        this.expenses = month;
        this.summary = summary;
        this.loading = false;
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los gastos.' });
        this.loading = false;
      }
    });
  }

  togglePaid(e: MonthlyExpense) {
    this.togglingId = e.fixedExpenseId;
    const req = e.paid
      ? this.expensesSvc.markUnpaid(e.fixedExpenseId, this.year, this.month)
      : this.expensesSvc.markPaid(e.fixedExpenseId, this.year, this.month);

    req.subscribe({
      next: () => {
        e.paid = !e.paid;
        e.paidAt = e.paid ? new Date().toISOString() : null;
        this.togglingId = null;
        this.refreshSummary();
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el estado.' });
        this.togglingId = null;
      }
    });
  }

  openCreate() {
    this.editingId = null;
    this.form.reset({ description: '', category: 'Servicio', dueDay: 1, amount: null, currency: 'ARS' });
    this.dialogVisible = true;
  }

  openEdit(e: MonthlyExpense) {
    this.editingId = e.fixedExpenseId;
    this.form.reset({
      description: e.description,
      category: e.category,
      dueDay: e.dueDay,
      amount: e.amount,
      currency: e.currency
    });
    this.dialogVisible = true;
  }

  save() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const payload: FixedExpensePayload = {
      description: v.description!.trim(),
      category: v.category!,
      dueDay: v.dueDay!,
      amount: v.amount!,
      currency: v.currency!
    };

    const req = this.editingId
      ? this.expensesSvc.update(this.editingId, payload)
      : this.expensesSvc.create(payload);

    req.subscribe({
      next: () => {
        this.toast.add({
          severity: 'success',
          summary: this.editingId ? 'Actualizado' : 'Creado',
          detail: 'Gasto fijo guardado correctamente.'
        });
        this.dialogVisible = false;
        this.saving = false;
        this.reload();
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar el gasto.' });
        this.saving = false;
      }
    });
  }

  confirmDelete(e: MonthlyExpense) {
    this.confirm.confirm({
      message: `¿Eliminar el gasto fijo "${e.description}"? Se borrará también su historial de pagos.`,
      header: 'Confirmar eliminación',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.expensesSvc.delete(e.fixedExpenseId).subscribe({
          next: () => {
            this.toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Gasto fijo eliminado.' });
            this.reload();
          },
          error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' })
        });
      }
    });
  }

  categorySeverity(cat: ExpenseCategory): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    switch (cat) {
      case 'Impuesto': return 'danger';
      case 'Servicio': return 'info';
      case 'Alquiler': return 'warning';
      case 'Pago': return 'success';
      default: return 'secondary';
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR');
  }

  private refreshSummary() {
    this.expensesSvc.summary(this.year, this.month).subscribe(s => this.summary = s);
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
