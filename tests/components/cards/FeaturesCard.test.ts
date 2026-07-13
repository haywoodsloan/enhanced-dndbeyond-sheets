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
              { name: 'Channel Divinity', resource: { max: 2, recharge: 'LR' } },
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
});
