import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  StudentAssignmentContentEditorExample,
  TeacherAssignmentContentEditorExample,
} from '../../src/features/teacher/preparation-document-editor/assignment-embedded-editor';

const hostProps = {
  initialValue: '公式 $G(s)$\n\n![闭环结构图](/api/assignment-assets/asset-1)',
  uploadImage: async () => ({
    assetId: 'asset-1',
    href: '/api/assignment-assets/asset-1',
  }),
  resolveAssetHref: (href: string) => href,
  persist: async () => undefined,
};

process.stdout.write(renderToStaticMarkup(createElement(
  'main',
  null,
  createElement('h1', null, '作业内容编辑器示例'),
  createElement(TeacherAssignmentContentEditorExample, hostProps),
  createElement(StudentAssignmentContentEditorExample, hostProps),
)));
