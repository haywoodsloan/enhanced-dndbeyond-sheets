import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FeaturesCard from '@/components/cards/FeaturesCard.vue';

describe('FeaturesCard', () => {
  it('renders grouped feature names', () => {
    const wrapper = mount(FeaturesCard, {
      props: {
        features: [
          { label: 'Class Features', items: ['Spellcasting', 'Channel Divinity'] },
          { label: 'Feats', items: ['Ability Score Improvement'] },
        ],
      },
    });

    const classFeatures = wrapper.get('[data-group="Class Features"]');
    expect(classFeatures.text()).toContain('Spellcasting');
    expect(classFeatures.text()).toContain('Channel Divinity');
    expect(wrapper.get('[data-group="Feats"]').text()).toContain(
      'Ability Score Improvement',
    );
  });
});
