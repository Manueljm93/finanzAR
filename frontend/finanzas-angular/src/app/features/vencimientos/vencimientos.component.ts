import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';

import { CardModule } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TooltipModule } from 'primeng/tooltip';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ConfirmationService, MessageService } from 'primeng/api';

import { VencimientosService } from './vencimientos.service';
import { ConnectionStatus, Remitente, Vencimiento, Confianza } from './vencimiento.model';

@Component({
  selector: 'app-vencimientos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    CardModule, TableModule, ButtonModule, DialogModule, InputTextModule,
    TagModule, ToastModule, ConfirmDialogModule, TooltipModule, ProgressSpinnerModule
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmDialog />

    <div class="flex flex-column gap-3">
      <h2 style="margin:0">Vencimientos</h2>

      <!-- Conexión Gmail -->
      <p-card>
        <div *ngIf="loadingConn" class="flex justify-content-center p-2">
          <p-progressSpinner strokeWidth="4" [style]="{'width':'32px','height':'32px'}" />
        </div>

        <div *ngIf="!loadingConn && conn" class="flex flex-wrap align-items-center gap-3">
          <i class="pi pi-envelope text-2xl" [class.text-primary]="conn.connected" [class.text-500]="!conn.connected"></i>

          <div *ngIf="conn.connected" class="flex-1">
            <div class="font-bold">Gmail conectado</div>
            <div class="text-sm text-600">{{ conn.email }}</div>
            <div class="text-xs text-500" *ngIf="conn.ultimaSync">Última sync: {{ formatDateTime(conn.ultimaSync) }}</div>
          </div>
          <div *ngIf="!conn.connected" class="flex-1">
            <div class="font-bold">Gmail no conectado</div>
            <div class="text-sm text-600">Conectá tu Gmail (solo lectura) para detectar vencimientos en tus facturas.</div>
          </div>

          <div class="flex gap-2">
            <p-button *ngIf="!conn.connected" label="Conectar Gmail" icon="pi pi-google"
              (onClick)="conectar()" [loading]="conectando" />
            <p-button *ngIf="conn.connected" label="Sincronizar ahora" icon="pi pi-sync"
              (onClick)="sincronizar()" [loading]="sincronizando" />
            <p-button *ngIf="conn.connected" label="Desconectar" icon="pi pi-times" severity="secondary"
              [text]="true" (onClick)="desconectar()" />
          </div>
        </div>
      </p-card>

      <!-- Remitentes -->
      <p-card header="Remitentes a monitorear">
        <div class="flex justify-content-end gap-2 mb-3">
          <p-button label="Cargar sugeridos" icon="pi pi-download" severity="secondary" [outlined]="true"
            (onClick)="cargarSugeridos()" [loading]="cargandoDefaults" />
          <p-button label="Agregar remitente" icon="pi pi-plus" (onClick)="openCreateRemitente()" />
        </div>

        <p-table [value]="remitentes" styleClass="p-datatable-sm" [paginator]="remitentes.length > 10" [rows]="10">
          <ng-template pTemplate="header">
            <tr>
              <th>Empresa</th>
              <th>Email</th>
              <th style="width:120px" class="text-center">Estado</th>
              <th style="width:100px"></th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-r>
            <tr [class.row-off]="!r.activo">
              <td class="font-medium">{{ r.empresa }}</td>
              <td class="text-600">{{ r.email }}</td>
              <td class="text-center">
                <p-button [label]="r.activo ? 'Activo' : 'Inactivo'"
                  [icon]="r.activo ? 'pi pi-check' : 'pi pi-ban'"
                  [severity]="r.activo ? 'success' : 'secondary'" [text]="!r.activo" size="small"
                  (onClick)="toggleActivo(r)" />
              </td>
              <td class="text-right">
                <p-button icon="pi pi-pencil" [text]="true" severity="secondary"
                  (onClick)="openEditRemitente(r)" pTooltip="Editar" />
                <p-button icon="pi pi-trash" [text]="true" severity="danger"
                  (onClick)="confirmDeleteRemitente(r)" pTooltip="Eliminar" />
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="4" class="text-center text-600 p-4">
              No hay remitentes. Usá "Cargar sugeridos" o agregá uno.
            </td></tr>
          </ng-template>
        </p-table>
      </p-card>

      <!-- Vencimientos detectados -->
      <p-card header="Próximos vencimientos">
        <p-table [value]="vencimientos" [loading]="loadingVenc" styleClass="p-datatable-sm"
          [paginator]="vencimientos.length > 12" [rows]="12">
          <ng-template pTemplate="header">
            <tr>
              <th style="width:150px">Vencimiento</th>
              <th>Empresa</th>
              <th>Período</th>
              <th style="width:160px" class="text-right">Monto</th>
              <th style="width:120px" class="text-center">Confianza</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-v>
            <tr>
              <td>
                <span *ngIf="v.fechaVencimiento; else sinFecha">
                  {{ formatDate(v.fechaVencimiento) }}
                  <div class="text-xs" [ngClass]="diasClass(v.fechaVencimiento)">{{ diasTexto(v.fechaVencimiento) }}</div>
                </span>
                <ng-template #sinFecha><span class="text-500">—</span></ng-template>
              </td>
              <td class="font-medium">{{ v.empresa }}</td>
              <td class="text-600">{{ v.periodo || '—' }}</td>
              <td class="text-right">
                <span *ngIf="v.montoTotal != null; else sinMonto">
                  <span *ngIf="v.moneda === 'USD'">U$S {{ v.montoTotal | number:'1.2-2' }}</span>
                  <span *ngIf="v.moneda !== 'USD'">{{ v.montoTotal | currency:'ARS':'symbol':'1.2-2' }}</span>
                </span>
                <ng-template #sinMonto><span class="text-500">—</span></ng-template>
              </td>
              <td class="text-center">
                <p-tag [value]="v.confianza" [severity]="confianzaSeverity(v.confianza)" />
              </td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr><td colspan="5" class="text-center text-600 p-4">
              No hay vencimientos detectados. Conectá Gmail y sincronizá.
            </td></tr>
          </ng-template>
        </p-table>
      </p-card>
    </div>

    <!-- Diálogo alta/edición remitente -->
    <p-dialog [(visible)]="dialogVisible" [header]="editingId ? 'Editar remitente' : 'Nuevo remitente'"
      [modal]="true" [style]="{'width':'420px'}" [draggable]="false">
      <form [formGroup]="form" (ngSubmit)="saveRemitente()" class="flex flex-column gap-3 pt-2">
        <div class="flex flex-column gap-1">
          <label for="empresa">Empresa</label>
          <input pInputText id="empresa" formControlName="empresa" placeholder="Ej: Edenor" />
        </div>
        <div class="flex flex-column gap-1">
          <label for="email">Email remitente</label>
          <input pInputText id="email" formControlName="email" placeholder="Ej: facturas@edenor.com" />
        </div>
        <div class="flex justify-content-end gap-2 pt-2">
          <p-button label="Cancelar" severity="secondary" [text]="true" (onClick)="dialogVisible = false" type="button" />
          <p-button label="Guardar" icon="pi pi-check" type="submit" [loading]="saving" [disabled]="form.invalid" />
        </div>
      </form>
    </p-dialog>
  `,
  styles: [`
    h2 { font-size:1.5rem; }
    .row-off td { opacity:.55; }
    .dias-venc { color:var(--red-500); font-weight:600; }
    .dias-pronto { color:var(--orange-500); font-weight:600; }
    .dias-ok { color:var(--text-color-secondary); }
  `]
})
export class VencimientosComponent implements OnInit {
  private svc = inject(VencimientosService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private confirm = inject(ConfirmationService);
  private toast = inject(MessageService);

  conn?: ConnectionStatus;
  remitentes: Remitente[] = [];
  vencimientos: Vencimiento[] = [];

  loadingConn = false;
  loadingVenc = false;
  conectando = false;
  sincronizando = false;
  cargandoDefaults = false;
  saving = false;

  dialogVisible = false;
  editingId: string | null = null;

  form = this.fb.group({
    empresa: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]]
  });

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    if (qp.get('connected') === '1')
      this.toast.add({ severity: 'success', summary: 'Gmail conectado', detail: 'Ya podés sincronizar tus vencimientos.' });
    else if (qp.get('error'))
      this.toast.add({ severity: 'error', summary: 'Error de conexión', detail: 'No se pudo conectar Gmail. Probá de nuevo.' });

    this.reload();
  }

  reload() {
    this.loadingConn = true;
    this.loadingVenc = true;
    forkJoin({
      conn: this.svc.connection(),
      remitentes: this.svc.remitentes(),
      vencimientos: this.svc.list()
    }).subscribe({
      next: ({ conn, remitentes, vencimientos }) => {
        this.conn = conn;
        this.remitentes = remitentes;
        this.vencimientos = vencimientos;
        this.loadingConn = false;
        this.loadingVenc = false;
      },
      error: () => {
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los datos.' });
        this.loadingConn = false;
        this.loadingVenc = false;
      }
    });
  }

  conectar() {
    this.conectando = true;
    this.svc.authUrl().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => {
        this.conectando = false;
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo iniciar la conexión con Gmail.' });
      }
    });
  }

  desconectar() {
    this.confirm.confirm({
      message: '¿Desconectar Gmail? Se borrará el acceso guardado (los vencimientos ya detectados quedan).',
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Desconectar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.disconnect().subscribe({
          next: () => { this.toast.add({ severity: 'success', summary: 'Desconectado', detail: 'Gmail desvinculado.' }); this.reload(); },
          error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo desconectar.' })
        });
      }
    });
  }

  sincronizar() {
    this.sincronizando = true;
    this.svc.sync().subscribe({
      next: res => {
        this.sincronizando = false;
        const detail = res.mensaje ?? `${res.nuevos} nuevo(s) de ${res.procesados} mail(s) procesado(s).`;
        this.toast.add({ severity: 'success', summary: 'Sincronizado', detail });
        this.reload();
      },
      error: err => {
        this.sincronizando = false;
        this.toast.add({ severity: 'error', summary: 'Error', detail: err?.error?.error ?? 'No se pudo sincronizar.' });
      }
    });
  }

  cargarSugeridos() {
    this.cargandoDefaults = true;
    this.svc.seedDefaults().subscribe({
      next: res => {
        this.cargandoDefaults = false;
        this.toast.add({ severity: 'success', summary: 'Listo', detail: `${res.agregados} remitente(s) agregado(s).` });
        this.svc.remitentes().subscribe(r => this.remitentes = r);
      },
      error: () => {
        this.cargandoDefaults = false;
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los sugeridos.' });
      }
    });
  }

  toggleActivo(r: Remitente) {
    this.svc.updateRemitente(r.id, { email: r.email, empresa: r.empresa, activo: !r.activo }).subscribe({
      next: upd => { r.activo = upd.activo; },
      error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar.' })
    });
  }

  openCreateRemitente() {
    this.editingId = null;
    this.form.reset({ empresa: '', email: '' });
    this.dialogVisible = true;
  }

  openEditRemitente(r: Remitente) {
    this.editingId = r.id;
    this.form.reset({ empresa: r.empresa, email: r.email });
    this.dialogVisible = true;
  }

  saveRemitente() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const activo = this.editingId ? this.remitentes.find(r => r.id === this.editingId)?.activo ?? true : true;
    const payload = { email: v.email!.trim(), empresa: v.empresa!.trim(), activo };
    const req = this.editingId ? this.svc.updateRemitente(this.editingId, payload) : this.svc.createRemitente(payload);

    req.subscribe({
      next: () => {
        this.toast.add({ severity: 'success', summary: this.editingId ? 'Actualizado' : 'Agregado', detail: 'Remitente guardado.' });
        this.dialogVisible = false;
        this.saving = false;
        this.svc.remitentes().subscribe(r => this.remitentes = r);
      },
      error: () => {
        this.saving = false;
        this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo guardar (¿email duplicado?).' });
      }
    });
  }

  confirmDeleteRemitente(r: Remitente) {
    this.confirm.confirm({
      message: `¿Eliminar el remitente "${r.empresa}"?`,
      header: 'Confirmar',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        this.svc.deleteRemitente(r.id).subscribe({
          next: () => { this.remitentes = this.remitentes.filter(x => x.id !== r.id); this.toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Remitente quitado.' }); },
          error: () => this.toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo eliminar.' })
        });
      }
    });
  }

  confianzaSeverity(c: Confianza): 'success' | 'warning' | 'danger' {
    return c === 'Alta' ? 'success' : c === 'Media' ? 'warning' : 'danger';
  }

  private dias(iso: string): number {
    const [y, m, d] = iso.split('-').map(Number);
    const venc = new Date(y, m - 1, d);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((venc.getTime() - hoy.getTime()) / 86400000);
  }

  diasTexto(iso: string): string {
    const n = this.dias(iso);
    if (n < 0) return `vencido hace ${-n} día(s)`;
    if (n === 0) return 'vence hoy';
    if (n === 1) return 'mañana';
    return `en ${n} días`;
  }

  diasClass(iso: string): string {
    const n = this.dias(iso);
    if (n < 0 || n === 0) return 'dias-venc';
    if (n <= 7) return 'dias-pronto';
    return 'dias-ok';
  }

  formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('es-AR');
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
