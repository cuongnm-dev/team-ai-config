// template_registry command (port from sdlc/template_registry.py).
//
// Templates are now JS template-literal functions in templates.mjs; load
// returns rendered output for a sample empty context, and "load" returns
// the source as JS string (not Jinja2 anymore — type label changed).

import { createHash } from 'node:crypto';

import { InvalidInputError, TemplateNotFoundError, successResponse } from './errors.mjs';
import { listTemplates, renderTemplate } from './templates.mjs';

const VALID_ACTIONS = new Set(['list', 'load']);

export function templateRegistryImpl(namespace, action, templateId = null) {
  if (!VALID_ACTIONS.has(action)) {
    throw new InvalidInputError(`Invalid action: ${JSON.stringify(action)} (expected list or load)`, {
      details: { action, valid: [...VALID_ACTIONS] },
    });
  }
  if (!namespace || !/^[A-Za-z0-9_-]+$/.test(namespace)) {
    throw new InvalidInputError(`Invalid namespace: ${JSON.stringify(namespace)}`, { details: { namespace } });
  }

  if (action === 'list') {
    const templates = listTemplates(namespace);
    return successResponse({ namespace, templates, count: templates.length });
  }

  // action === 'load'
  if (!templateId) {
    throw new InvalidInputError('action=load requires template_id', { details: { missing: ['template_id'] } });
  }
  if (templateId.includes('..') || templateId.startsWith('/') || templateId.startsWith('\\')) {
    throw new InvalidInputError(`Invalid template_id: ${JSON.stringify(templateId)} (path traversal not allowed)`,
      { details: { template_id: templateId } });
  }

  // Render with empty context — for sample preview. Real callers use the
  // command directly through scaffold subcommands rather than load API.
  let content;
  try {
    content = renderTemplate(`${namespace}/${templateId}`, {});
  } catch (err) {
    throw new TemplateNotFoundError(`Template not found: ${namespace}/${templateId}`, {
      details: { namespace, template_id: templateId, original_error: err.message },
    });
  }

  const sha = createHash('sha256').update(content, 'utf-8').digest('hex');
  return successResponse({
    namespace, template_id: templateId,
    content,
    sha256: `sha256:${sha}`,
    type: 'js-template-literal',
    size: content.length,
  });
}
