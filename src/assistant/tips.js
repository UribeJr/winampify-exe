// Everything Disky can say. Cheeky but polite: each tip shows once, and he naps instead of nagging.
// actions: buttons shown in the speech bubble ({ label, action }); 'close' just dismisses.

export const TIPS = [
  {
    id: 'welcome',
    event: 'first-visit',
    mood: 'wave',
    priority: true, // delivered before anything else that queued up while a dialog was open
    text: "Hi! I'm Disky. It looks like you're new here. Want a quick tour?",
    actions: [{ label: 'Show me', action: 'tour' }, { label: 'No thanks', action: 'close' }]
  },
  {
    id: 'player-opened',
    event: 'player-opened',
    mood: 'happy',
    text: 'Psst — right-click the desktop any time for sticky notes and wallpaper. I live down here if you need me.'
  },
  {
    id: 'note-created',
    event: 'note-created',
    mood: 'surprised',
    text: 'Ooh, a note! Right-click its title bar to change the color. Pink is very in this year.'
  },
  {
    id: 'display-opened',
    event: 'display-opened',
    mood: 'happy',
    text: "Nice choice! Next time, try Browse… in Display Properties to put your own photo on the desktop. I won't judge. Much."
  },
  {
    id: 'xp-skin',
    event: 'display-xp-hint',
    mood: 'happy',
    text: 'Feeling fancy? Appearance → "Windows and buttons" has an XP style. Same me, shinier buttons.'
  },
  {
    id: 'server-unreachable',
    event: 'server-unreachable',
    mood: 'confused',
    text: "It looks like I can't reach your music server. Are you on your home network?"
  },
  {
    id: 'search-empty',
    event: 'search-empty',
    mood: 'confused',
    text: 'Nothing for that one. Try an artist or album name? I hum a lot, but I can\'t hum that.'
  },
  {
    id: 'run-unknown',
    event: 'run-unknown',
    mood: 'confused',
    text: "Even I can't find that program, and I've looked everywhere. Twice."
  },
  {
    id: 'hello',
    event: 'hello',
    mood: 'wave',
    once: false,
    text: 'Hello yourself! Did you know you can type "notes" in Run… for a fresh sticky note?'
  },
  {
    id: 'dizzy',
    event: 'dizzy',
    mood: 'confused',
    once: false,
    text: "Okay, okay, I'm awake! Please stop spinning me."
  }
];

// Shown when you wake him up or ask for a tip. These repeat (randomly), unlike the tips above.
export const FUN_FACTS = [
  'Windows 98 shipped on a CD. I like to think of it as my great-great-grandparent.',
  'The original Windows 98 startup sound was under seven seconds long.',
  'You can double-click a sticky note\'s title bar to roll it up.',
  'Start → Settings → Wallpaper… has five wallpapers. Rolling Hills is my favorite. Don\'t tell the others.',
  'A CD spins up to 500 times a minute. I get dizzy just thinking about it.',
  'Right-click a note\'s title bar to paint it pink, blue or green.',
  'Deleted notes go to the Recycle Bin. You can bring them back. Second chances!',
  'Press Start → Run… and type "desk.cpl" for Display Properties, like it\'s 1998.',
  'Dial-up modems screamed at 56 kbit/s. I\'m much quieter.',
  'The Media Player remembers your queue, even if you refresh the page.',
  'In the player, drag the progress bar to scrub through a song.',
  'You can switch music services from Start → Log Off.',
  'Minimize the player and your sticky notes are still waiting on the desktop.',
  'A "floppy" disk held 1.44 MB. That\'s about one song. Barely.',
  'Shut Down… → Restart Winampify is the classic "have you tried turning it off and on again".'
];

export const TOUR = [
  {
    target: '.taskbar-start',
    mood: 'talk',
    text: 'This is the Start button. Programs, themes, wallpaper and Run… all live in here.'
  },
  {
    target: '.desktop-icon:first-child',
    mood: 'happy',
    text: 'Double-click — or just click — Media Player to open your music library.'
  },
  {
    target: '.wmp-desktop-area',
    mood: 'wave',
    text: "Right-click (or long-press) the desktop for sticky notes, wallpaper and themes. That's the tour!"
  }
];

export const tipById = (id) => TIPS.find((t) => t.id === id) || null;
export const tipForEvent = (event) => TIPS.find((t) => t.event === event) || null;
