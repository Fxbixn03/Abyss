/**
 * Guided product tour — a small, ordered walkthrough shown once on first launch
 * (after onboarding) and replayable from Settings. Each step optionally pins to
 * a route and spotlights a DOM element tagged with `data-tour="<target>"`.
 *
 * Adding a step: append an entry here and tag the element with the matching
 * `data-tour` attribute. The overlay handles navigation, measuring and
 * positioning automatically.
 */

export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export interface TourStep {
  id: string
  title: string
  body: string
  /** Route to navigate to before showing this step. */
  route?: string
  /** `data-tour` value of the element to spotlight. Omit for a centered step. */
  target?: string
  /** Where the explanation card sits relative to the spotlight. */
  placement?: TourPlacement
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Abyss',
    body: 'Abyss is one home for every AI coding agent on your machine. This short tour points out the main areas — it takes less than a minute.',
    route: '/',
    placement: 'center',
  },
  {
    id: 'agent-switcher',
    title: 'Switch agents',
    body: 'Pick the agent you want to configure here. The whole app re-themes instantly and shows only the settings that agent supports.',
    route: '/',
    target: 'agent-switcher',
    placement: 'bottom',
  },
  {
    id: 'sidebar',
    title: 'Navigate everything',
    body: 'The sidebar groups every configuration surface — instructions, MCP servers, permissions, hooks and more. It adapts to the active agent.',
    route: '/',
    target: 'sidebar',
    placement: 'right',
  },
  {
    id: 'scope-bar',
    title: 'Global or project scope',
    body: 'Toggle between your global config and a specific project. Project settings layer on top of your global ones.',
    route: '/',
    target: 'scope-bar',
    placement: 'bottom',
  },
  {
    id: 'search',
    title: 'Jump anywhere',
    body: 'Use the search bar — or press ⌘K / Ctrl+K — to jump to any page, file or action without leaving the keyboard.',
    route: '/',
    target: 'global-search',
    placement: 'bottom',
  },
  {
    id: 'agent-grid',
    title: 'Your agents at a glance',
    body: 'Each card shows whether an agent is installed and links straight to its official documentation. Click a card to make it active.',
    route: '/',
    target: 'agent-grid',
    placement: 'bottom',
  },
  {
    id: 'instructions',
    title: 'Edit instruction files',
    body: 'Every page works the same way: a clear header, the editable content below. This is where you tune the instructions loaded into each session.',
    route: '/config',
    target: 'page-header',
    placement: 'bottom',
  },
  {
    id: 'settings',
    title: 'Tweak it your way',
    body: 'Settings holds config paths, appearance, backups and more — and you can replay this tour any time from the Preferences tab.',
    route: '/settings',
    target: 'page-header',
    placement: 'bottom',
  },
  {
    id: 'done',
    title: "You're all set",
    body: 'That’s the tour. Explore at your own pace — and remember ⌘K is the fastest way to get around.',
    route: '/',
    placement: 'center',
  },
]
