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

  it('labels feature references to other dedicated cards', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          {
            label: 'Class Features',
            items: [
              { name: 'Weapon Training', reference: 'attacks' },
              { name: 'Mystic Arcanum', reference: 'spells' },
              { name: 'Steel Defender', related: ['companions'] },
              { name: 'Experimental Elixir', related: ['tables'] },
              { name: 'Vital Training', reference: 'basics' },
            ],
          },
        ],
      },
    });

    const items = wrapper.findAll('[data-feature]');
    expect(items[0].text()).toContain('(see Attacks)');
    expect(items[1].text()).toContain('(see Spells)');
    expect(items[2].text()).toContain('(see Companions)');
    expect(items[3].text()).toContain('(see Tables)');
    expect(items[4].text()).toContain('(see basics)');
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
