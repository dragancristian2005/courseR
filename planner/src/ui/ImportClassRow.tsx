import {
  effectiveBlock,
  planSubjectFor,
  type ImportAnswers,
  type ImportPlan,
  type ImportQuestion,
} from '../domain/importPlan';
import type { ClassType } from '../domain/types';
import { ImportBlockRow } from './ImportBlockRow';
import { ChooseOneQuestion, TypeQuestion, UnsureQuestion } from './ImportQuestionBox';

/** Display name of a block's subject text: the plan's full name, else the text itself. */
export const subjectNameOf = (plan: ImportPlan, text: string): string =>
  planSubjectFor(plan, text)?.name ?? text;

/** One class of the sheet with whatever question it carries (alternative, type, misread). */
export function ImportClassRow({
  index: i,
  plan,
  answers,
  dropped,
  rowKey,
  invalid,
  onAnswers,
  onValidChange,
}: {
  index: number;
  plan: ImportPlan;
  answers: ImportAnswers;
  dropped: boolean;
  /** Identifies the row across group changes, so its local edit state starts over. */
  rowKey: string;
  /** Its inline edit holds values that can't be saved. */
  invalid: boolean;
  onAnswers: (fn: (a: ImportAnswers) => ImportAnswers) => void;
  onValidChange: (valid: boolean) => void;
}) {
  const block = effectiveBlock(plan, answers, i);
  const choice = plan.questions.find(
    (q): q is Extract<ImportQuestion, { kind: 'choose-one' }> =>
      q.kind === 'choose-one' && q.options.includes(i),
  );
  const choiceOpen = choice !== undefined && answers.chosen[choice.id] === undefined;
  const typeQ = !dropped && plan.questions.some((q) => q.kind === 'type' && q.block === i);
  const unsureQ = plan.questions.find((q) => q.kind === 'unsure' && q.block === i);
  const open =
    invalid ||
    choiceOpen ||
    (!dropped && block.type === null) ||
    (!dropped && unsureQ !== undefined && answers.edits[i] === undefined);
  const setType = (t: ClassType) => onAnswers((a) => ({ ...a, types: { ...a.types, [i]: t } }));
  return (
    <ImportBlockRow
      testID={`import-block-${i}`}
      block={block}
      title={subjectNameOf(plan, block.subject)}
      open={open}
      dimmed={dropped}
    >
      {choice !== undefined && choice.options[0] === i ? (
        <ChooseOneQuestion
          options={choice.options.map((index) => ({
            index,
            block: effectiveBlock(plan, answers, index),
            title: subjectNameOf(plan, effectiveBlock(plan, answers, index).subject),
          }))}
          chosen={answers.chosen[choice.id]}
          onChoose={(index) =>
            onAnswers((a) => ({ ...a, chosen: { ...a.chosen, [choice.id]: index } }))
          }
        />
      ) : null}
      {typeQ ? <TypeQuestion value={block.type} onChange={setType} /> : null}
      {!dropped && unsureQ !== undefined && unsureQ.kind === 'unsure' ? (
        <UnsureQuestion
          key={rowKey}
          onValidChange={onValidChange}
          fields={unsureQ.fields}
          block={block}
          showType={!typeQ}
          type={block.type}
          onType={setType}
          onEdit={(p) =>
            onAnswers((a) => ({ ...a, edits: { ...a.edits, [i]: { ...a.edits[i], ...p } } }))
          }
        />
      ) : null}
    </ImportBlockRow>
  );
}
