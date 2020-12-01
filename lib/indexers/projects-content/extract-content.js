require('@asl/service/lib/register');

const { Value } = require('slate');
const { omit, flattenDeep } = require('lodash');
const { getSubsections } = require('@asl/projects/client/schema');

const schema = [
  getSubsections(0),
  getSubsections(1)
];

const getFieldValue = (data, field) => {
  let value = data[field.name];

  switch (field.type) {
    case 'text':
    case 'keywords':
      return [value];
    case 'texteditor':
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch (e) {
          return [];
        }
      }
      const text = [];
      for (const txt of Value.fromJSON(value || {}).document.texts()) {
        const [t] = txt;
        text.push(t.text);
      }
      return text;
    default:
      if (field.options) {
        const revealed = field.options.find(opt => opt.value === value && opt.reveal);
        if (revealed) {
          const subfields = Array.isArray(revealed.reveal) ? revealed.reveal : [revealed.reveal];
          return subfields.map(f => getFieldValue(data, f));
        }
      }
  }
};

const getProtocolsContent = (data, schema) => {
  const protocols = (data.protocols || []).filter(p => p && !p.deleted);

  if (!protocols.length) {
    return {};
  }

  return protocols.reduce((map, protocol, i) => {
    let value = Object.values(schema.sections).reduce((arr, section) => {
      return [...arr, ...getSectionContent({ ...data, ...protocol }, section)];
    }, [ protocol.title ]);

    value = flattenDeep(value).filter(Boolean).join('\n\n');

    if (!value) {
      return map;
    }

    return {
      ...map,
      [i]: value
    };
  }, {});
};

const getSectionContent = (data, section) => {

  if (section.name === 'protocols' || section.name === 'protocol') {
    return getProtocolsContent(data, section);
  }

  if (section.show && !section.show(data)) {
    return [];
  }

  if (section.steps) {
    return section.steps.map(step => getSectionContent(data, step));
  }

  if (section.repeats === 'objectives') {
    return section.fields.reduce((arr, field) => {
      let value = getFieldValue(data, field);
      if (field.name === 'title') {
        value = (data.objectives || []).map(o => o.title);
      }
      if (!value || !value.length) {
        return arr;
      }
      if (!arr.length) {
        return value;
      }
      return [...arr, ...value];
    }, []);
  }

  if (section.repeats) {
    return (data[section.repeats] || []).map(repeater => getSectionContent({ ...data, ...repeater }, omit(section, 'repeats')));
  }

  if (section.fields) {
    return section.fields.reduce((arr, field) => {
      const value = getFieldValue(data, field);
      if (!value || !value.length) {
        return arr;
      }
      if (!arr.length) {
        return value;
      }
      return [...arr, ...value];
    }, []);
  }

};

module.exports = (data, {schemaVersion, id}) => {

  const sections = schema[schemaVersion];

  return Object.keys(sections).reduce((map, key) => {
    let content = getSectionContent(data, sections[key]);

    if (!content) {
      return map;
    }

    if (key !== 'protocols') {
      content = flattenDeep(content).filter(Boolean).join('\n\n');
    }

    return {
      ...map,
      [key]: content
    };
  }, {});

};
