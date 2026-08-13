import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import RichText from '@/components/RichText.vue';

describe('RichText', () => {
  it('allows long unbroken rule tokens to wrap inside cards', () => {
    const wrapper = mount(RichText, { props: { text: 'x'.repeat(100) } });
    expect(wrapper.get('.rich-text').classes()).toContain('rich-text');
  });

  it('breaks inline bullet runs onto their own lines', () => {
    const wrapper = mount(RichText, {
      props: {
        text: 'While active, Rage follows these rules: • You have Resistance. • You gain a bonus.',
      },
    });

    const bullets = wrapper.findAll('[data-rich-text-bullet]');
    expect(bullets.map((node) => node.text())).toEqual([
      'You have Resistance.',
      'You gain a bonus.',
    ]);
    // The marker is supplied by CSS, so it must not be duplicated in the text.
    expect(wrapper.text()).not.toContain('•');
  });

  it('keeps bold markers working inside a bullet', () => {
    const wrapper = mount(RichText, {
      props: { text: 'Benefits: • **Damage.** You deal more.' },
    });

    expect(wrapper.get('[data-rich-text-bullet]').get('strong').text()).toBe('Damage.');
  });

  it('renders text wrapped in ** as bold, leaving the rest plain', () => {
    const wrapper = mount(RichText, {
      props: { text: 'Choose the command: **Approach.** The target moves toward you.' },
    });

    const bold = wrapper.findAll('strong');
    expect(bold).toHaveLength(1);
    expect(bold[0].text()).toBe('Approach.');
    // The full text is still there, just with the markers consumed.
    expect(wrapper.text()).toBe('Choose the command: Approach. The target moves toward you.');
    expect(wrapper.html()).not.toContain('**');
  });

  it('renders multiple bold headings', () => {
    const wrapper = mount(RichText, {
      props: { text: '**Approach.** moves you **Drop.** drops it **Halt.** stops' },
    });

    expect(wrapper.findAll('strong').map((node) => node.text())).toEqual([
      'Approach.',
      'Drop.',
      'Halt.',
    ]);
  });

  it('renders plain text with no markers and does not treat text as HTML', () => {
    const wrapper = mount(RichText, { props: { text: 'A plain <b>blurb</b> & more' } });

    expect(wrapper.findAll('strong')).toHaveLength(0);
    // Angle brackets are shown literally, never parsed as markup (XSS-safe).
    expect(wrapper.text()).toBe('A plain <b>blurb</b> & more');
    expect(wrapper.find('b').exists()).toBe(false);
  });
});
