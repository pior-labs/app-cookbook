import { Panel, Wordmark } from '@cookbook/web';

export function Default() {
  return <Wordmark />;
}

export function Sizes() {
  return (
    <div className="flex flex-col gap-5">
      <Wordmark size={28} textClass="text-[18px]" />
      <Wordmark size={34} />
      <Wordmark size={48} textClass="text-[30px]" />
    </div>
  );
}

export function InTheRail() {
  return (
    <Panel className="inline-block">
      <Wordmark />
    </Panel>
  );
}
