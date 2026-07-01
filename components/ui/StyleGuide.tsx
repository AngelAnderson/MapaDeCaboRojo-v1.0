import React from 'react';
import { Button } from './Button';
import { Chip } from './Chip';
import { Badge } from './Badge';
import { Card } from './Card';
import { Skeleton, SkeletonCard } from './Skeleton';
import { Spinner } from './Spinner';
import { Field, Input, Textarea } from './Field';
import { toast, toastSuccess, toastError } from './toast';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-4">
    <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
    <div className="flex flex-wrap items-center gap-3">{children}</div>
  </section>
);

const Swatch: React.FC<{ name: string; cls: string }> = ({ name, cls }) => (
  <div className="text-center">
    <div className={`w-14 h-14 rounded-lg shadow-e1 ${cls}`} />
    <div className="text-2xs text-ink-muted mt-1">{name}</div>
  </div>
);

/** Living style guide for the Level-20 design system. Route: ?page=ui */
export const StyleGuide: React.FC = () => {
  const [dark, setDark] = React.useState(document.documentElement.classList.contains('dark'));
  const toggleDark = () => {
    document.documentElement.classList.toggle('dark');
    setDark(document.documentElement.classList.contains('dark'));
  };
  return (
    <div className="min-h-screen bg-canvas text-ink px-5 py-8 md:px-10">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm text-ink-muted uppercase tracking-widest">Mapa de Cabo Rojo</p>
            <h1 className="font-display text-4xl font-semibold">Sistema de Diseño</h1>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleDark}>{dark ? 'Claro' : 'Oscuro'}</Button>
        </header>

        <Section title="Marca">
          {['bg-brand-50','bg-brand-100','bg-brand-200','bg-brand-300','bg-brand-400','bg-brand-500','bg-brand-600','bg-brand-700','bg-brand-800','bg-brand-900'].map(c => (
            <Swatch key={c} name={c.replace('bg-brand-','')} cls={c} />
          ))}
        </Section>
        <Section title="Coral (El Faro)">
          {['bg-coral-50','bg-coral-100','bg-coral-200','bg-coral-300','bg-coral-400','bg-coral-500','bg-coral-600','bg-coral-700','bg-coral-800','bg-coral-900'].map(c => (
            <Swatch key={c} name={c.replace('bg-coral-','')} cls={c} />
          ))}
        </Section>
        <Section title="Arena (neutrales cálidos)">
          {['bg-sand-50','bg-sand-100','bg-sand-200','bg-sand-300','bg-sand-400','bg-sand-500','bg-sand-600','bg-sand-700','bg-sand-800','bg-sand-900'].map(c => (
            <Swatch key={c} name={c.replace('bg-sand-','')} cls={c} />
          ))}
        </Section>

        <Section title="Tipografía">
          <div className="w-full space-y-2">
            <p className="font-display text-5xl font-semibold">Cabo Rojo, en orden</p>
            <p className="font-display text-2xl">Fraunces display serif</p>
            <p className="text-lg">Source Sans 3 — el cuerpo del texto, legible y cálido.</p>
            <p className="text-sm text-ink-soft">Texto secundario para detalles y apoyo.</p>
            <p className="text-xs text-ink-muted uppercase tracking-wide">Etiqueta / caption</p>
          </div>
        </Section>

        <Section title="Botones">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="gold">Gold</Button>
          <Button loading>Loading</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </Section>

        <Section title="Chips">
          <Chip active>Todos</Chip>
          <Chip>Comer</Chip>
          <Chip tone="brand" active>Playas</Chip>
          <Chip>Salud</Chip>
        </Section>

        <Section title="Badges">
          <Badge tone="brand">Verificado</Badge>
          <Badge tone="gold" solid>Vitrina</Badge>
          <Badge tone="coral">Cerrado</Badge>
          <Badge tone="neutral">Free</Badge>
        </Section>

        <Section title="Cards + elevación">
          <Card className="p-5 w-52" elevation={1}><p className="font-semibold">Elevation 1</p><p className="text-sm text-ink-soft">surface</p></Card>
          <Card className="p-5 w-52" elevation={3} interactive><p className="font-semibold">Interactive</p><p className="text-sm text-ink-soft">hover me</p></Card>
          <Card glass className="p-5 w-52"><p className="font-semibold">Glass</p><p className="text-sm text-ink-soft">frosted</p></Card>
        </Section>

        <Section title="Loading">
          <Spinner label="Cargando negocios" />
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <SkeletonCard /><SkeletonCard />
          </div>
        </Section>

        <Section title="Formularios">
          <div className="w-full max-w-md space-y-4">
            <Field label="Nombre del negocio" required hint="Como aparece en el letrero">
              <Input placeholder="Ej: Tino's" />
            </Field>
            <Field label="Descripción" error="Este campo es obligatorio">
              <Textarea rows={3} placeholder="¿Qué resuelve este negocio?" />
            </Field>
          </div>
        </Section>

        <Section title="Toasts">
          <Button variant="secondary" onClick={() => toast('Mensaje neutral')}>Default</Button>
          <Button variant="secondary" onClick={() => toastSuccess('Guardado ✓')}>Success</Button>
          <Button variant="secondary" onClick={() => toastError('Algo falló')}>Error</Button>
        </Section>
      </div>
    </div>
  );
};

export default StyleGuide;
