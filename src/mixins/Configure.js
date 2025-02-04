/**
 * @copyright Copyright (c) 2021 Andrey Borysenko <andrey18106x@gmail.com>
 *
 * @copyright Copyright (c) 2021 Alexander Piskun <bigcat88@icloud.com>
 *
 * @author Andrey Borysenko <andrey18106x@gmail.com>
 *
 * @license AGPL-3.0-or-later
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { generateUrl } from '@nextcloud/router'
import axios from '@nextcloud/axios'
import { showError, showSuccess, showWarning } from '@nextcloud/dialogs'

export default {
	created() {
		this.$emit('update:loading', true)
		this.getSettings()
		if (this.$route.name !== 'configuration') {
			this.$emit('update:loading', true)
		}
		this.getInstalledSetting()
	},
	data() {
		return {
			installed_setting: null,
			installed: false,
			installed_list: [],
			not_installed_list: {},
			video_required: [],
			available_algorithms: [],
			errors: [],
			warnings: [],
			installing: false,
			checking: false,
			updating: false,
		}
	},
	methods: {
		async getSettings() {
			return axios.get(generateUrl('/apps/mediadc/api/v1/settings')).then(res => {
				this.$store.dispatch('setSettings', res.data)
				this.$emit('update:loading', false)
			})
		},
		async getInstalledSetting() {
			axios.get(generateUrl('/apps/mediadc/api/v1/settings/name/installed')).then(res => {
				if (res.data.success) {
					this.$store.dispatch('updateSetting', res.data.setting)
					this.installed_setting = res.data.setting
					this.installed_setting.value = JSON.parse(this.installed_setting.value)
					this.installed = res.data.setting.value.status
					this.installed_list = this.installed_setting.value.installed_list
					this.not_installed_list = {
						required: this.installed_setting.value.not_installed_list.required,
						optional: this.installed_setting.value.not_installed_list.optional,
						boost: this.installed_setting.value.not_installed_list.boost,
					}
					this.available_algorithms = this.installed_setting.value.available_algorithms
					this.video_required = this.installed_setting.value.video_required
					if (!this.installed && this.$route.name !== 'configuration') {
						this.$router.push({ name: 'configuration' })
					} else {
						this.$emit('update:loading', false)
					}
				}
			})
		},
		async install() {
			this.installing = true
			axios.get(generateUrl('/apps/mediadc/api/v1/python/install')).then(res => {
				this.parsePythonResponseData(res)
				this.updateInstalledSetting().then(() => {
					this.installing = false
					if (res.data.success) {
						showSuccess(t('mediadc', 'Installation successfully finished'))
					} else if (!res.data.success && res.data.installed) {
						showWarning(t('mediadc', 'Installation finished. Not all packages installed'))
					} else {
						showError(t('mediadc', 'Installation failed. Try again.'))
					}
				}).catch(() => {
					this.installing = false
					showError(t('mediadc', 'Installation failed. Try again.'))
				})
			})
		},
		async updateInstalledSetting() {
			return axios.put(generateUrl('/apps/mediadc/api/v1/settings/name/installed'), { setting: this.installed_setting })
		},
		async installDepsList(listName) {
			this.updating = true
			axios.post(generateUrl('/apps/mediadc/api/v1/python/install'), { listName }).then(res => {
				this.parsePythonResponseData(res)
				this.updateInstalledSetting().then(() => {
					this.updating = false
					if (res.data.success) {
						showSuccess(t('mediadc', 'Package list successfully installed'))
					} else {
						showError(t('mediadc', 'Package list installation failed'))
					}
				}).catch(() => {
					this.updating = false
					showError(t('mediadc', 'Package list installation failed'))
				})
			})
		},
		async deleteDepsList(listName) {
			this.updating = true
			axios.post(generateUrl('/apps/mediadc/api/v1/python/delete'),
				{ packagesList: Object.values(this.installed_list[listName]).filter(item => item.location !== 'global').map(item => item.package) }).then(res => {
				this.parsePythonResponseData(res)
				this.updateInstalledSetting().then(() => {
					this.updating = false
					if (res.data.success) {
						showSuccess(t('mediadc', 'Package list successfully deleted'))
					} else {
						showError(t('mediadc', 'Some error occured while deleting package list'))
					}
				})
			}).catch(err => {
				console.debug(err)
				this.updating = false
				showError(t('mediadc', 'Some error occured while deleting packages'))
			})
		},
		async updateDepsList(listName) {
			this.updating = true
			axios.post(generateUrl('/apps/mediadc/api/v1/python/update'),
				{ packagesList: Object.values(this.installed_list[listName]).filter(item => item.location !== 'global').map(item => item.package) }).then(res => {
				this.parsePythonResponseData(res)
				this.updateInstalledSetting().then(() => {
					this.updating = false
					if (res.data.success) {
						showSuccess(t('mediadc', 'Packages successfully updated'))
					} else {
						showError(t('mediadc', 'Packages update failed. Try again.'))
					}
				})
			}).catch(err => {
				console.debug(err)
				showError(t('mediadc', 'Packages update failed'))
			})
		},
		async check() {
			this.checking = true
			axios.get(generateUrl('/apps/mediadc/api/v1/python/check')).then(res => {
				this.parsePythonResponseData(res)
				this.updateInstalledSetting().then(() => {
					this.checking = false
					if (res.data.installed) {
						showSuccess(t('mediadc', 'All required dependencies installed'))
					} else {
						showError(t('mediadc', 'Not all required packages installed'))
					}
				}).catch(err => {
					this.checking = false
					console.debug(err)
					showError(t('mediadc', 'Dependencies checking failed. Try again.'))
				})
			}).catch(err => {
				console.debug(err)
				showError(t('mediadc', 'Dependencies checking failed. Try again.'))
				this.checking = false
			})
		},
		parsePythonResponseData(res) {
			this.installed = res.data.installed
			this.installed_setting.value.status = res.data.installed
			this.installed_setting.value.installed_list = res.data.installed_list
			this.installed_setting.value.not_installed_list = {
				required: res.data.required,
				optional: res.data.optional,
				boost: res.data.boost,
			}
			this.installed_setting.value.available_algorithms = res.data.available_algorithms
			this.installed_setting.value.video_required = res.data.video_required
			this.$store.dispatch('setSetting', this.installed_setting)
			this.installed_list = res.data.installed_list
			this.not_installed_list = {
				required: res.data.required,
				optional: res.data.optional,
				boost: res.data.boost,
			}
			this.available_algorithms = res.data.available_algorithms
			this.video_required = res.data.video_required
			this.errors = res.data.errors
			this.warnings = res.data.warnings
		},
		finishConfiguration() {
			this.$emit('update:loading', true)
			this.$router.push({ name: 'collector' })
		},
	},
}
