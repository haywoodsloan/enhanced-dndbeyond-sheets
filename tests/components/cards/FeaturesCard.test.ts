import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FeaturesCard from '@/components/cards/FeaturesCard.vue';

describe('FeaturesCard', () => {
  it('renders grouped feature names', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          { label: 'Class Features', items: [{ name: 'Spellcasting' }, { name: 'Channel Divinity' }] },
          { label: 'Feats', items: [{ name: 'Skill Expert' }] },
        ],
      },
    });

    const classFeatures = wrapper.get('[data-group="Class Features"]');
    expect(classFeatures.text()).toContain('Spellcasting');
    expect(classFeatures.text()).toContain('Channel Divinity');
    expect(wrapper.get('[data-group="Feats"]').text()).toContain('Skill Expert');
  });

  it('renders empty checkboxes and a recharge tag for a limited-use feature', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Class Features',
            items: [
              {
                name: 'Channel Divinity',
                resource: { max: 2, recovery: { kind: 'rest', rest: 'long' } },
              },
              { name: 'Circle of Mortality' },
            ],
          },
        ],
      },
    });

    const items = wrapper.findAll('[data-feature]');
    expect(items).toHaveLength(2);
    // The limited-use feature gets one empty box per use plus the recharge tag…
    const channelDivinity = items[0];
    expect(channelDivinity.findAll('.resource__box')).toHaveLength(2);
    expect(channelDivinity.text()).toContain('Long rest');
    // …a passive feature has none.
    expect(items[1].find('[data-resource]').exists()).toBe(false);
  });

  it('renders a feature summary blurb when present', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Racial Traits',
            items: [
              { name: 'Fey Ancestry', summary: 'You have Advantage against being Charmed.' },
              { name: 'Trance' },
            ],
          },
        ],
      },
    });

    const items = wrapper.findAll('[data-feature]');
    expect(items[0].find('.features__summary').text()).toBe(
      'You have Advantage against being Charmed.',
    );
    // A feature without a summary shows no blurb line.
    expect(items[1].find('.features__summary').exists()).toBe(false);
  });

  it('renders named sub-parts, pointing action sub-parts to the Actions card', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Class Features',
            items: [
              {
                name: 'Circle of Mortality',
                summary: 'You gain the following benefits.',
                parts: [
                  { label: 'Pull of Death', text: '', reference: 'actions' },
                  {
                    label: 'Return to Life',
                    text: 'You can cast Spare the Dying as a Bonus Action.',
                  },
                  { label: '', text: 'Use the highest number possible for each healing die.' },
                ],
              },
            ],
          },
        ],
      },
    });

    const parts = wrapper.findAll('[data-feature-part]');
    expect(parts).toHaveLength(3);
    // An action sub-part shows its bold heading + a pointer to the Actions card.
    expect(parts[0].find('.features__part-name').text()).toBe('Pull of Death');
    expect(parts[0].text()).toContain('(see Actions)');
    expect(parts[0].find('.features__reference').exists()).toBe(true);
    // A non-action sub-part shows heading + text.
    expect(parts[1].text()).toContain('Return to Life');
    expect(parts[1].text()).toContain('Spare the Dying');
    // An un-named rider shows just its text.
    expect(parts[2].find('.features__part-name').exists()).toBe(false);
    expect(parts[2].text()).toContain('highest number possible');
  });

  it('keeps every feature in a single column, whatever its shape', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Class Features',
            items: [
              {
                name: 'Infuse Item',
                parts: [
                  { label: 'Infusions Known', text: 'You know four infusions.' },
                  { label: 'Infused Items', text: 'You can infuse two items.' },
                ],
              },
              { name: 'Simple Feature' },
            ],
          },
        ],
      },
    });

    const items = wrapper.findAll('[data-feature]');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.classes()).toContain('features__item');
      // Nothing is allowed to run across the columns; a forced break between
      // items is fine, splitting one open is not.
      expect(item.classes()).not.toContain('features__item--flowing');
    }
  });

  it('splits into segments only when continuation-safe breaks are requested', () => {
    const features = [
      {
        label: 'Class Features',
        items: Array.from({ length: 9 }, (_, index) => ({
          name: `Feature ${index}`,
          summary: 'Tall enough to matter. '.repeat(18),
        })),
      },
    ];
    const compact = mount(FeaturesCard, { props: { features } });
    // One masonry list packs the whole group when the card fits on a page.
    expect(compact.findAll('[data-feature-segment]')).toHaveLength(1);

    const continued = mount(FeaturesCard, { props: { features, rowAligned: true } });
    // Segments close once they fill two columns, so the gaps between them are safe cuts.
    expect(continued.findAll('[data-feature-segment]')).toHaveLength(3);
    expect(continued.findAll('[data-feature]')).toHaveLength(9);
  });

  it('lets a feature too tall for one column wrap into the next', () => {
    const features = [
      {
        label: 'Class Features',
        items: [
          { name: 'Short Feature' },
          { name: 'Wild Shape', summary: 'Taller than a page-long column. '.repeat(95) },
          { name: 'Another Feature' },
        ],
      },
    ];
    const continued = mount(FeaturesCard, { props: { features, rowAligned: true } });
    const segments = continued.findAll('[data-feature-segment]');
    // The tall feature is alone in its segment, so the card can cut either side of it.
    expect(segments.map((segment) => segment.findAll('[data-feature]').length)).toEqual([1, 1, 1]);
    expect(segments[1].get('[data-feature]').classes()).toContain('features__item--flowing');
    expect(segments[0].get('[data-feature]').classes()).not.toContain('features__item--flowing');

    const compact = mount(FeaturesCard, { props: { features } });
    expect(compact.find('.features__item--flowing').exists()).toBe(false);
  });

  it('heads the second column of a split feature with the feature name', () => {
    const part = (label: string) => ({ label, text: 'Long enough to fill a column. '.repeat(30) });
    const features = [
      {
        label: 'Class Features',
        items: [
          {
            name: 'Wild Shape',
            summary: 'The power of nature allows you to assume the form of a Beast.',
            parts: [part('Number of Uses'), part('Known Forms'), part('Beast Shapes')],
          },
        ],
      },
    ];

    const continued = mount(FeaturesCard, { props: { features, rowAligned: true } });
    const names = continued.findAll('.features__name').map((node) => node.text());
    expect(names).toEqual(['Wild Shape', 'Wild Shape (cont.)']);
    // The summary belongs to the first chunk only; the parts are split between them.
    expect(continued.findAll('.features__summary')).toHaveLength(1);
    const chunks = continued.findAll('[data-feature]');
    expect(chunks.map((chunk) => chunk.findAll('[data-feature-part]').length)).toEqual([1, 2]);

    const compact = mount(FeaturesCard, { props: { features } });
    expect(compact.findAll('.features__name').map((node) => node.text())).toEqual(['Wild Shape']);
  });

  it('keeps reading order so the browser can balance the columns', () => {
    const long = 'A benefit worth several lines of text. '.repeat(12);
    const features = [
      {
        label: 'Racial Traits',
        items: [
          { name: 'Languages', grants: [{ label: 'Languages', items: ['Common'] }] },
          { name: 'Bestial Instincts', grants: [{ label: 'Skills', items: ['Athletics'] }] },
          { name: 'Beasthide', summary: long },
        ],
      },
    ];

    // Reordering to "deal" items into columns can pair the two heaviest and
    // strand a light one; column flow already cuts where the columns level up.
    const wrapper = mount(FeaturesCard, { props: { features } });
    expect(wrapper.findAll('.features__name').map((node) => node.text())).toEqual([
      'Languages',
      'Bestial Instincts',
      'Beasthide',
    ]);
  });

  it('labels feature references to other dedicated cards', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        companionTitle: 'Wild Shapes',
        features: [
          {
            label: 'Class Features',
            items: [
              { name: 'Weapon Training', reference: 'attacks' },
              { name: 'Mystic Arcanum', reference: 'spells' },
              { name: 'Steel Defender', related: ['companions'] },
              {
                name: 'Experimental Elixir',
                summary: 'Roll to determine the elixir effect.',
                related: ['tables'],
              },
              { name: 'Vital Training', reference: 'basics' },
            ],
          },
        ],
      },
    });

    const byName = new Map(
      wrapper
        .findAll('[data-feature]')
        .map((item) => [item.get('.features__name').text(), item.text()] as const),
    );
    expect(byName.get('Weapon Training')).toContain('(see Attacks)');
    expect(byName.get('Mystic Arcanum')).toContain('(see Spells)');
    expect(byName.get('Steel Defender')).toContain('(see Wild Shapes)');
    const elixir = byName.get('Experimental Elixir') ?? '';
    expect(elixir).toContain('(see Tables)');
    expect(elixir.indexOf('Roll to determine the elixir effect.')).toBeLessThan(
      elixir.indexOf('(see Tables)'),
    );
    expect(byName.get('Vital Training')).toContain('(see Basics)');
  });

  it('lists feature-granted spells without rendering their use trackers', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Class Features',
            items: [
              {
                name: 'Draconic Spells',
                summary: 'You always have the listed spells prepared.',
                grantedSpells: ['Alter Self', 'Chromatic Orb', 'Command'],
              },
            ],
          },
        ],
      },
    });

    expect(wrapper.get('[data-feature-spells]').text()).toBe(
      'Spells: Alter Self, Chromatic Orb, Command',
    );
    expect(wrapper.find('[data-resource]').exists()).toBe(false);
  });

  it('renders level-grouped spell grants under their matching feature parts', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Feats',
            items: [
              {
                name: 'Magic Initiate (Cleric)',
                summary: 'You gain the following benefits.',
                parts: [
                  {
                    label: 'Two Cantrips',
                    text: 'You learn two Cleric cantrips.',
                    grantedSpells: ['Spare the Dying', 'Word of Radiance'],
                  },
                  {
                    label: 'Level 1 Spell',
                    text: 'Choose a level 1 Cleric spell.',
                    grantedSpells: ['Bless'],
                  },
                  { label: 'Spell Change', text: 'You can replace a chosen spell.' },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(wrapper.find('[data-feature-spells]').exists()).toBe(false);
    const parts = wrapper.findAll('[data-feature-part]');
    expect(parts[0].get('[data-feature-part-spells]').text()).toBe(
      'Cantrips: Spare the Dying, Word of Radiance',
    );
    expect(parts[1].get('[data-feature-part-spells]').text()).toBe('Spell: Bless');
    expect(parts[2].find('[data-feature-part-spells]').exists()).toBe(false);
  });

  it('renders labeled language and spell grants together', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Class Features',
            items: [
              {
                name: 'Druidic',
                grants: [{ label: 'Languages', items: ['Druidic'] }],
                grantedSpells: ['Speak with Animals'],
              },
            ],
          },
        ],
      },
    });

    expect(wrapper.get('[data-feature-grant]').text()).toBe('Languages: Druidic');
    expect(wrapper.get('[data-feature-spells]').text()).toBe('Spells: Speak with Animals');
    expect(wrapper.find('.features__summary').exists()).toBe(false);
  });

  it('renders structured feature options as an actual list', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Feats',
            items: [
              {
                name: 'Crafter',
                parts: [
                  {
                    label: 'Fast Crafting',
                    text: 'Craft one piece of gear after a Long Rest.',
                    list: {
                      label: 'Crafted Gear',
                      items: [
                        { label: "Carpenter's Tools", text: 'Ladder, Torch' },
                        { label: "Smith's Tools", text: 'Ball Bearings, Bucket' },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const list = wrapper.get('[data-feature-list]');
    expect(list.element.tagName).toBe('DIV');
    expect(list.find('ul').exists()).toBe(true);
    expect(list.findAll('li')).toHaveLength(2);
    expect(list.findAll('[data-structured-list-item]').map((item) => item.text())).toEqual([
      "Carpenter's ToolsLadder, Torch",
      "Smith's ToolsBall Bearings, Bucket",
    ]);
  });
});
